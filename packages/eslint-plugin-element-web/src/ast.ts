/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import type { RuleTester } from "oxlint/plugins-dev";

/** An oxlint rule, as accepted by {@link RuleTester.run}. */
export type Rule = Parameters<RuleTester["run"]>[1];
type Visitor = ReturnType<NonNullable<Rule["create"]>>;
/** The rule context passed to `create`. */
export type Context = Parameters<NonNullable<Rule["create"]>>[0];
export type CallExpression = Parameters<NonNullable<Visitor["CallExpression"]>>[0];
/** Any AST node. */
export type Node = NonNullable<CallExpression["parent"]>;
export type NodeOfType<T extends Node["type"]> = Extract<Node, { type: T }>;

export type AnyFunction = NodeOfType<"ArrowFunctionExpression" | "FunctionExpression" | "FunctionDeclaration">;
type AnyClass = NodeOfType<"ClassDeclaration" | "ClassExpression">;

// TypeScript-only wrappers which do not change the runtime value of the expression they wrap
const TRANSPARENT_WRAPPERS = new Set([
    "TSAsExpression",
    "TSNonNullExpression",
    "TSSatisfiesExpression",
    "ChainExpression",
]);

/** Returns the parent of `node`, skipping over type assertions and optional chains. */
export function getParent(node: Node): Node | null {
    let parent = node.parent ?? null;
    while (parent && TRANSPARENT_WRAPPERS.has(parent.type)) parent = parent.parent ?? null;
    return parent;
}

/** Strips type assertions and optional chains from `node`. */
export function unwrap(node: Node): Node {
    while (TRANSPARENT_WRAPPERS.has(node.type)) node = (node as { expression: Node }).expression;
    return node;
}

/** Whether `node` is a function of any syntax. */
export function isFunction(node: Node | null | undefined): node is AnyFunction {
    return (
        node?.type === "ArrowFunctionExpression" ||
        node?.type === "FunctionExpression" ||
        node?.type === "FunctionDeclaration"
    );
}

/** Returns the closest function containing `node`, or null if it is at module level. */
export function getEnclosingFunction(node: Node): AnyFunction | null {
    for (let current = node.parent; current; current = current.parent) {
        if (isFunction(current)) return current;
    }
    return null;
}

/** Returns the closest class containing `node`, or null if there is none. */
export function getEnclosingClass(node: Node): AnyClass | null {
    for (let current = node.parent; current; current = current.parent) {
        if (current.type === "ClassDeclaration" || current.type === "ClassExpression") return current;
    }
    return null;
}

/** Calls `callback` for `node` and every node below it. */
export function walk(node: Node, callback: (node: Node) => void): void {
    callback(node);
    for (const [key, value] of Object.entries(node)) {
        if (key === "parent" || !value || typeof value !== "object") continue;
        for (const child of Array.isArray(value) ? value : [value]) {
            if (child && typeof child === "object" && typeof child.type === "string") walk(child as Node, callback);
        }
    }
}

/** Returns the name of the method called by `node`, e.g. `off` for `emitter.off(...)`. */
export function getCalledMethodName(node: CallExpression): string | null {
    const callee = unwrap(node.callee);
    if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return null;
    return callee.property.name;
}

/** Returns the object a method is called on, e.g. `emitter` for `emitter.off(...)`. */
export function getCalledMethodObject(node: CallExpression): Node | null {
    const callee = unwrap(node.callee);
    return callee.type === "MemberExpression" ? callee.object : null;
}

/** Returns the name of the function or hook called by `node`, ignoring a namespace such as `React.`. */
export function getCalleeName(node: CallExpression): string | null {
    const callee = unwrap(node.callee);
    if (callee.type === "Identifier") return callee.name;
    if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier") {
        return callee.property.name;
    }
    return null;
}

/**
 * Returns the source text of `node` with optional chaining and non-null assertions removed,
 * so that `this.foo?.bar` and `this.foo!.bar` compare equal to `this.foo.bar`.
 */
export function normalisedText(context: Context, node: Node): string {
    return context.sourceCode
        .getText(node)
        .replace(/\?\./g, ".")
        .replace(/!(?=[.)\]]|$)/g, "")
        .replace(/\s+/g, "");
}

// Methods whose presence shows that a class has a teardown phase which should release what it acquired
const TEARDOWN_METHODS = new Set(["componentWillUnmount", "dispose", "destroy"]);
// Methods which run as part of teardown. `close` is often reached through a base class's `destroy`, which
// this per-class analysis cannot see, so it counts too, but its presence alone does not imply a teardown phase.
const TEARDOWN_SCOPE_METHODS = new Set([...TEARDOWN_METHODS, "close"]);

// Base classes with a teardown phase: React class components, and view models (which inherit `dispose`)
const LIFECYCLE_SUPERCLASS = /(^|\.)(Pure)?Component$|ViewModel$/;

/**
 * Whether `node` is a class with a clear end of life: a React class component, a view model, or a class
 * with a teardown method such as `dispose`. Long-lived singletons without one are deliberately excluded.
 */
export function isLifecycleClass(context: Context, node: AnyClass): boolean {
    if (node.superClass && LIFECYCLE_SUPERCLASS.test(context.sourceCode.getText(node.superClass))) {
        return true;
    }
    // A static teardown method resets a singleton rather than ending an instance's life
    return node.body.body.some(
        (member) =>
            (member.type === "MethodDefinition" || member.type === "PropertyDefinition") &&
            !member.static &&
            member.key.type === "Identifier" &&
            TEARDOWN_METHODS.has(member.key.name),
    );
}

/** Whether `node` is the callback passed to `useEffect` or `useLayoutEffect`. */
export function isEffectCallback(node: Node): boolean {
    const parent = node.parent;
    if (!isFunction(node) || parent?.type !== "CallExpression" || parent.arguments[0] !== node) return false;
    const name = getCalleeName(parent);
    return name === "useEffect" || name === "useLayoutEffect";
}

/** Returns the function a class member defines, for both `foo() {}` and `foo = () => {}`. */
function getMemberFunction(member: Node): AnyFunction | null {
    // A method's value can also be a body-less overload or abstract declaration
    if (member.type === "MethodDefinition") return isFunction(member.value) ? member.value : null;
    if (member.type === "PropertyDefinition" && member.value && isFunction(unwrap(member.value))) {
        return unwrap(member.value) as AnyFunction;
    }
    return null;
}

// Names which mark a function, or the place it is stored, as cleanup to run later
const CLEANUP_NAME = /clean|dispos|teardown|unsub|unwatch|unlisten|detach/i;
// Methods which store a function they are given, e.g. `cleanups.push(fn)` or `disposables.track(fn)`
const STORING_METHODS = new Set(["push", "add", "set", "track"]);

/** Returns the name `node` is stored under, e.g. `cleanup` for `this.cleanup` or `const cleanup`. */
function getTargetName(node: Node): string | null {
    node = unwrap(node);
    if (node.type === "Identifier") return node.name;
    if (node.type === "MemberExpression" && node.property.type === "Identifier") return node.property.name;
    return null;
}

/**
 * Whether the closure `fn` is cleanup which its class stores to run later: pushed onto a list, handed to
 * something which registers cleanup, assigned to a cleanup-named variable or field, or returned (typically
 * as an unsubscribe function). Other closures, such as event handlers, are not teardown.
 */
function isStoredCleanup(fn: Node): boolean {
    const parent = getParent(fn);
    if (parent?.type === "CallExpression" && parent.arguments.includes(fn as never)) {
        const name = getCalledMethodName(parent) ?? getCalleeName(parent) ?? "";
        return STORING_METHODS.has(name) || CLEANUP_NAME.test(name);
    }
    if (parent?.type === "AssignmentExpression" && unwrap(parent.right) === fn) {
        return CLEANUP_NAME.test(getTargetName(parent.left) ?? "");
    }
    if (parent?.type === "VariableDeclarator" && parent.init && unwrap(parent.init) === fn) {
        return CLEANUP_NAME.test(getTargetName(parent.id) ?? "");
    }
    return parent?.type === "ReturnStatement" || (parent?.type === "ArrowFunctionExpression" && parent.body === fn);
}

/** Returns the name of `this.name`, or null if `node` is anything else. */
function getThisPropertyName(node: Node): string | null {
    node = unwrap(node);
    if (node.type !== "MemberExpression" || node.object.type !== "ThisExpression") return null;
    return node.property.type === "Identifier" ? node.property.name : null;
}

/**
 * Returns the parts of a class which run when it is torn down:
 * - its teardown methods, such as `dispose`
 * - functions handed to `disposables.track(...)`, inline or as `this.method`
 * - cleanup closures, which the class stores to run later, e.g. `this.cleanups.push(() => emitter.off(...))`
 * - its own methods and setters which any of those call or assign to, followed transitively
 */
export function getClassTeardownScopes(node: AnyClass): Node[] {
    const methods = new Map<string, AnyFunction>();
    const setters = new Map<string, AnyFunction>();
    const memberFunctions = new Set<Node>();
    for (const member of node.body.body) {
        const fn = getMemberFunction(member);
        if (!fn || !("key" in member) || member.key.type !== "Identifier" || member.static) continue;
        memberFunctions.add(fn);
        if (member.type === "MethodDefinition" && member.kind === "set") setters.set(member.key.name, fn);
        else methods.set(member.key.name, fn);
    }

    const scopes: Node[] = [];
    const add = (fn: Node | undefined): void => {
        if (fn && !scopes.includes(fn)) scopes.push(fn);
    };
    for (const name of TEARDOWN_SCOPE_METHODS) add(methods.get(name));
    walk(node, (child) => {
        if (isFunction(child) && !memberFunctions.has(child) && isStoredCleanup(child)) {
            add(child);
        } else if (child.type === "CallExpression" && getCalledMethodName(child) === "track" && child.arguments[0]) {
            add(methods.get(getThisPropertyName(child.arguments[0]) ?? ""));
        }
    });

    // Follow calls to the class's own methods, e.g. a dispose() which calls this.stopListening(),
    // and assignments to its setters, e.g. a componentWillUnmount() which sets this.user = null
    for (let i = 0; i < scopes.length; i++) {
        walk(scopes[i], (child) => {
            if (child.type === "CallExpression") {
                add(methods.get(getThisPropertyName(child.callee) ?? ""));
            } else if (child.type === "AssignmentExpression") {
                add(setters.get(getThisPropertyName(child.left) ?? ""));
            }
        });
    }
    return scopes;
}

/** Returns the cleanup functions an effect callback returns, e.g. `() => emitter.off(...)`. */
export function getEffectCleanupScopes(effect: AnyFunction): Node[] {
    if (effect.body.type !== "BlockStatement") {
        const body = unwrap(effect.body);
        return isFunction(body) ? [body] : [];
    }
    const scopes: Node[] = [];
    walk(effect.body, (child) => {
        // Only the effect's own return statements, not those of functions nested inside it
        if (child.type !== "ReturnStatement" || !child.argument || getEnclosingFunction(child) !== effect) return;
        const returned = unwrap(child.argument);
        if (isFunction(returned)) scopes.push(returned);
    });
    return scopes;
}

/** Returns the cleanup functions of every effect a component or hook declares directly in its body. */
export function getHookTeardownScopes(owner: AnyFunction): Node[] {
    const scopes: Node[] = [];
    walk(owner.body, (child) => {
        if (isEffectCallback(child) && getEnclosingFunction(child) === owner) {
            scopes.push(...getEffectCleanupScopes(child as AnyFunction));
        }
    });
    return scopes;
}

/** Whether any node within `scopes` satisfies `predicate`. */
export function someInScopes(scopes: Node[], predicate: (node: Node) => boolean): boolean {
    let found = false;
    for (const scope of scopes) {
        walk(scope, (node) => {
            if (!found && predicate(node)) found = true;
        });
        if (found) break;
    }
    return found;
}

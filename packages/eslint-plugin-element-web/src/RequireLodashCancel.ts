/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
    type AnyFunction,
    type CallExpression,
    type Context,
    type Node,
    type Rule,
    getCalleeName,
    getCalledMethodName,
    getCalledMethodObject,
    getClassTeardownScopes,
    getEnclosingClass,
    getEnclosingFunction,
    getHookTeardownScopes,
    getParent,
    isFunction,
    isLifecycleClass,
    normalisedText,
    someInScopes,
} from "./ast.ts";

// lodash functions which return a function with pending work that has to be cancelled
const CANCELLABLE = new Set(["debounce", "throttle"]);
const LODASH_MODULES = new Set(["lodash", "lodash-es"]);

/** Returns the lodash function imported by a module specifier such as `lodash/throttle`, if any. */
function getPerMethodImport(source: string): string | null {
    const match = /^lodash(?:-es)?[/.](\w+)$/.exec(source);
    return match && CANCELLABLE.has(match[1]) ? match[1] : null;
}

/**
 * Finds the variable that holds the result of `call`, when `call` is the value given to a React hook:
 * `useMemo(() => throttle(...))`, `useCallback(throttle(...))` or `useRef(throttle(...))`.
 * Returns the expression that must have `.cancel()` called on it (e.g. `ref.current` for `useRef`),
 * and the component or hook function that owns it.
 */
function getHookTarget(call: CallExpression): { target: string; owner: AnyFunction } | null {
    let node: Node = call;
    let parent = getParent(node);
    // Step out of a factory function, e.g. useMemo(() => throttle(...)) or useMemo(() => { return throttle(...); })
    if (parent?.type === "ReturnStatement") {
        const block = parent.parent;
        if (block?.type === "BlockStatement" && isFunction(block.parent)) node = block.parent;
    } else if (parent?.type === "ArrowFunctionExpression" && parent.body === node) {
        node = parent;
    }
    parent = getParent(node);
    if (parent?.type !== "CallExpression" || !parent.arguments.includes(node)) return null;

    const hook = getCalleeName(parent);
    if (hook !== "useMemo" && hook !== "useCallback" && hook !== "useRef") return null;
    const declarator = getParent(parent);
    const owner = getEnclosingFunction(parent);
    if (declarator?.type !== "VariableDeclarator" || declarator.id.type !== "Identifier" || !owner) return null;
    return { target: hook === "useRef" ? `${declarator.id.name}.current` : declarator.id.name, owner };
}

/** Whether `scopes` contain a call of `target.cancel()`. */
function hasCancelCall(context: Context, scopes: Node[], target: string): boolean {
    return someInScopes(scopes, (node) => {
        if (node.type !== "CallExpression" || getCalledMethodName(node) !== "cancel") return false;
        const object = getCalledMethodObject(node);
        return !!object && normalisedText(context, object) === target;
    });
}

/** Whether lodash is told not to make a trailing call, which leaves nothing pending to cancel. */
function hasNoTrailingCall(call: CallExpression): boolean {
    const options = call.arguments[2];
    return (
        options?.type === "ObjectExpression" &&
        options.properties.some(
            (property) =>
                property.type === "Property" &&
                property.key.type === "Identifier" &&
                property.key.name === "trailing" &&
                property.value.type === "Literal" &&
                property.value.value === false,
        )
    );
}

const rule: Rule = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Require lodash `debounce` and `throttle` functions owned by a component, hook or disposable class to be cancelled on teardown.",
        },
        messages: {
            missingCancel:
                "`{{target}}` is a lodash {{method}} that is not cancelled at teardown. Call `{{target}}.cancel()` on unmount or dispose (or in an effect cleanup) so that a pending call cannot run afterwards.",
        },
        schema: [],
    },
    create(context) {
        // Local names bound to lodash's debounce/throttle, and names bound to the whole lodash module
        const methodNames = new Map<string, string>();
        const namespaceNames = new Set<string>();

        /** Returns which lodash method `call` invokes, if it is a cancellable one. */
        function getLodashMethod(call: CallExpression): string | null {
            const callee = call.callee;
            if (callee.type === "Identifier") return methodNames.get(callee.name) ?? null;
            if (
                callee.type === "MemberExpression" &&
                callee.object.type === "Identifier" &&
                namespaceNames.has(callee.object.name) &&
                callee.property.type === "Identifier" &&
                CANCELLABLE.has(callee.property.name)
            ) {
                return callee.property.name;
            }
            return null;
        }

        return {
            ImportDeclaration(node) {
                const source = String(node.source.value);
                const perMethod = getPerMethodImport(source);
                for (const specifier of node.specifiers) {
                    if (perMethod && specifier.type === "ImportDefaultSpecifier") {
                        methodNames.set(specifier.local.name, perMethod);
                    } else if (LODASH_MODULES.has(source)) {
                        if (specifier.type === "ImportSpecifier") {
                            const imported = normalisedText(context, specifier.imported).replace(/["']/g, "");
                            if (CANCELLABLE.has(imported)) methodNames.set(specifier.local.name, imported);
                        } else {
                            namespaceNames.add(specifier.local.name);
                        }
                    }
                }
            },
            CallExpression(node) {
                const method = getLodashMethod(node);
                if (!method || hasNoTrailingCall(node)) return;

                const parent = getParent(node);
                let target: string | null = null;
                // Where the cancel must happen: at teardown, not merely somewhere in the owner
                let scopes: Node[] | null = null;

                if (parent?.type === "PropertyDefinition" && parent.value === node && !parent.static) {
                    // Class field: `private onFoo = throttle(...)`
                    const owner = getEnclosingClass(node);
                    if (!owner || !isLifecycleClass(context, owner)) return;
                    target = `this.${normalisedText(context, parent.key)}`;
                    scopes = getClassTeardownScopes(owner);
                } else if (
                    parent?.type === "AssignmentExpression" &&
                    parent.right === node &&
                    parent.left.type === "MemberExpression" &&
                    parent.left.object.type === "ThisExpression"
                ) {
                    // Assignment in a class method: `this.onFoo = throttle(...)`
                    const owner = getEnclosingClass(node);
                    if (!owner || !isLifecycleClass(context, owner)) return;
                    target = normalisedText(context, parent.left);
                    scopes = getClassTeardownScopes(owner);
                } else {
                    // React hook: `const onFoo = useMemo(() => throttle(...), [])`
                    const hookTarget = getHookTarget(node);
                    target = hookTarget?.target ?? null;
                    scopes = hookTarget ? getHookTeardownScopes(hookTarget.owner) : null;
                }

                if (!target || !scopes || hasCancelCall(context, scopes, target)) return;
                context.report({ node, messageId: "missingCancel", data: { target, method } });
            },
        };
    },
};

export default rule;

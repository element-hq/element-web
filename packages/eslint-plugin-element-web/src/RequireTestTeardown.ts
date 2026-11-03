/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
    type Node,
    type Rule,
    getCalleeName,
    getEnclosingFunction,
    getParent,
    getTargetName,
    isFunction,
    someInScopes,
    walk,
} from "./ast.ts";

interface Options {
    /** Matches the names of classes whose instances must be torn down. */
    classes: string;
    /** Methods which tear an instance down. */
    methods?: string[];
    /** Names of classes which match {@link classes} but hold on to nothing which outlives them. */
    ignore?: string[];
    /** Functions which tear down the instance passed to them, such as `tearDownAfterTest(vm)`. */
    helpers?: string[];
}

const DEFAULT_METHODS = ["destroy", "dispose", "stop", "close"];
// Hooks which run after each test, where shared instances are typically torn down
const AFTER_HOOKS = new Set(["afterEach", "afterAll", "onTestFinished"]);

/** Returns the callbacks passed to `afterEach`, `afterAll` and `onTestFinished` anywhere in `program`. */
function getAfterHookCallbacks(program: Node): Node[] {
    const callbacks: Node[] = [];
    walk(program, (node) => {
        if (node.type !== "CallExpression" || !AFTER_HOOKS.has(getCalleeName(node) ?? "")) return;
        const callback = node.arguments[0];
        if (isFunction(callback)) callbacks.push(callback);
    });
    return callbacks;
}

/**
 * Whether `scopes` call one of `methods` on `name`, e.g. `store.destroy()` or `this.vm?.dispose()`, or pass `name`
 * to one of `helpers`, e.g. `tearDownAfterTest(vm)`.
 */
function hasTeardown(scopes: Node[], name: string, methods: Set<string>, helpers: Set<string>): boolean {
    return someInScopes(scopes, (node) => {
        if (node.type === "CallExpression") {
            const argument = node.arguments[0];
            return helpers.has(getCalleeName(node) ?? "") && !!argument && getTargetName(argument) === name;
        }
        return (
            node.type === "MemberExpression" &&
            !node.computed &&
            node.property.type === "Identifier" &&
            methods.has(node.property.name) &&
            getTargetName(node.object) === name
        );
    });
}

/** Whether `fn` returns `name`, on its own or inside an object or array, handing the instance to its caller. */
function returnsName(fn: Node, name: string): boolean {
    let found = false;
    walk(fn, (node) => {
        if (found || node.type !== "ReturnStatement" || !node.argument || getEnclosingFunction(node) !== fn) return;
        walk(node.argument, (child) => {
            if (child.type === "Identifier" && child.name === name) found = true;
        });
    });
    return found;
}

const rule: Rule = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Require tests to tear down the stores, view models and other objects they create, so that what those objects register on long-lived singletons does not accumulate for the rest of the test file.",
        },
        messages: {
            discarded:
                "This `{{className}}` is discarded, so it can never be torn down. Keep it and call one of {{methods}} on it after the test.",
            missingTeardown:
                "`{{name}}` is never torn down. Call one of {{methods}} on it in the test or in `afterEach`.",
        },
        schema: [
            {
                type: "object",
                properties: {
                    classes: { type: "string" },
                    methods: { type: "array", items: { type: "string" } },
                    ignore: { type: "array", items: { type: "string" } },
                    helpers: { type: "array", items: { type: "string" } },
                },
                required: ["classes"],
                additionalProperties: false,
            },
        ],
    },
    create(context) {
        // The schema guarantees this shape
        const options = context.options[0] as unknown as Options | undefined;
        if (!options) return {};
        const classes = new RegExp(options.classes);
        const methods = new Set(options.methods ?? DEFAULT_METHODS);
        const ignore = new Set(options.ignore);
        const helpers = new Set(options.helpers);
        const methodList = [...methods].map((m) => `\`${m}\``).join(", ");
        let afterHookCallbacks: Node[] | undefined;

        return {
            NewExpression(node) {
                if (node.callee.type !== "Identifier" || !classes.test(node.callee.name)) return;
                if (ignore.has(node.callee.name)) return;
                const className = node.callee.name;
                const parent = getParent(node);

                if (parent?.type === "ExpressionStatement") {
                    context.report({ node, messageId: "discarded", data: { className, methods: methodList } });
                    return;
                }

                let name: string | null = null;
                if (parent?.type === "VariableDeclarator" && parent.init && getParent(parent.init) === parent) {
                    name = getTargetName(parent.id);
                } else if (parent?.type === "AssignmentExpression" && getParent(parent.right) === parent) {
                    name = getTargetName(parent.left);
                }
                // Instances which are returned, or handed to something else, are that code's responsibility
                if (!name) return;

                afterHookCallbacks ??= getAfterHookCallbacks(context.sourceCode.ast);
                const enclosing = getEnclosingFunction(node);
                if (enclosing && returnsName(enclosing, name)) return;
                const scopes = enclosing ? [enclosing, ...afterHookCallbacks] : afterHookCallbacks;
                if (!hasTeardown(scopes, name, methods, helpers)) {
                    context.report({ node, messageId: "missingTeardown", data: { name, methods: methodList } });
                }
            },
        };
    },
};

export default rule;

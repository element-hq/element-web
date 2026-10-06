/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
    type CallExpression,
    type Context,
    type Node,
    type Rule,
    getCalleeName,
    getClassTeardownScopes,
    getEnclosingClass,
    getParent,
    isLifecycleClass,
    normalisedText,
    someInScopes,
    unwrap,
} from "./ast.ts";

// Functions which schedule work, and the functions which cancel it
const TIMER_FUNCTIONS = new Set(["setTimeout", "setInterval", "requestAnimationFrame", "requestIdleCallback"]);
const CLEAR_FUNCTIONS = new Set(["clearTimeout", "clearInterval", "cancelAnimationFrame", "cancelIdleCallback"]);
// Objects the timer functions may be called on, e.g. `window.setTimeout`
const TIMER_HOSTS = new Set(["window", "globalThis", "self"]);

/** Returns the timer or clear function `call` invokes, e.g. `setTimeout` for `window.setTimeout(...)`. */
function getGlobalFunctionName(call: CallExpression): string | null {
    const callee = unwrap(call.callee);
    if (callee.type === "Identifier") return callee.name;
    if (
        callee.type === "MemberExpression" &&
        callee.object.type === "Identifier" &&
        TIMER_HOSTS.has(callee.object.name)
    ) {
        return getCalleeName(call);
    }
    return null;
}

/** Whether `scopes` clear the timer whose ID is stored in `target`. */
function hasClear(context: Context, scopes: Node[], target: string): boolean {
    return someInScopes(scopes, (node) => {
        if (node.type !== "CallExpression" || !node.arguments[0]) return false;
        const name = getGlobalFunctionName(node);
        return !!name && CLEAR_FUNCTIONS.has(name) && normalisedText(context, node.arguments[0]) === target;
    });
}

const rule: Rule = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Require timers whose ID a component or disposable class stores on itself to be cleared on teardown.",
        },
        messages: {
            missingClear:
                "`{{target}}` holds a {{timer}} that is not cleared at teardown. Clear it on unmount or dispose so that it cannot fire afterwards.",
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                const timer = getGlobalFunctionName(node);
                if (!timer || !TIMER_FUNCTIONS.has(timer)) return;

                // Only timers whose ID is kept on the instance: `this.timer = setTimeout(...)`.
                // Timers in hooks are covered by react-web-api/no-leaked-timeout and friends.
                const parent = getParent(node);
                if (
                    parent?.type !== "AssignmentExpression" ||
                    unwrap(parent.right) !== node ||
                    parent.left.type !== "MemberExpression" ||
                    parent.left.object.type !== "ThisExpression"
                ) {
                    return;
                }
                const owner = getEnclosingClass(node);
                if (!owner || !isLifecycleClass(context, owner)) return;

                const target = normalisedText(context, parent.left);
                if (hasClear(context, getClassTeardownScopes(owner), target)) return;
                context.report({ node, messageId: "missingClear", data: { target, timer } });
            },
        };
    },
};

export default rule;

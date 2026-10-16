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
    getCalledMethodName,
    getEnclosingClass,
    getEnclosingFunction,
    getParent,
    isLifecycleClass,
    walk,
} from "./ast.ts";

const LISTENER_METHODS = new Set(["on", "addListener", "addEventListener"]);
const PROMISE_CALLBACK_METHODS = new Set(["then", "catch", "finally"]);
// A condition mentioning one of these is taken to check that the owner has not been torn down
const LIFECYCLE_CHECK = /unmount|mounted|dispos|destroy/i;

/** Returns a description of what `call` subscribes to, or null if it is not a subscription. */
function getSubscription(context: Context, call: CallExpression): string | null {
    const method = getCalledMethodName(call);
    if (method && LISTENER_METHODS.has(method) && call.arguments.length >= 2) {
        // A used return value is typically an unsubscribe function, which the caller then owns
        if (getParent(call)?.type !== "ExpressionStatement") return null;
        return `listener for ${context.sourceCode.getText(call.arguments[0])}`;
    }
    if (getCalleeName(call) === "watchSetting") return "setting watcher";
    return null;
}

/** Returns the source offset of `node`'s start or end. */
function offset(node: Node, edge: 0 | 1): number {
    return (node as unknown as { range: [number, number] }).range[edge];
}

/**
 * Returns the source offset after which code in `fn` may run asynchronously: the end of the last `await`
 * before `before`, or the start of `fn` if it is a promise callback. Returns null if there is no such gap.
 */
function getAsyncGap(fn: Node, before: Node): number | null {
    const parent = getParent(fn);
    if (parent?.type === "CallExpression" && PROMISE_CALLBACK_METHODS.has(getCalledMethodName(parent) ?? "")) {
        return offset(fn, 0);
    }
    let gap: number | null = null;
    walk(fn, (node) => {
        if (node.type !== "AwaitExpression" || getEnclosingFunction(node) !== fn) return;
        if (offset(node, 1) <= offset(before, 0)) gap = Math.max(gap ?? 0, offset(node, 1));
    });
    return gap;
}

/** Whether `fn` checks the owner's lifecycle in a condition between `from` and the start of `call`. */
function hasLifecycleCheck(context: Context, fn: Node, from: number, call: Node): boolean {
    let found = false;
    walk(fn, (node) => {
        if (found) return;
        const test =
            node.type === "IfStatement" || node.type === "WhileStatement" || node.type === "ConditionalExpression"
                ? node.test
                : null;
        if (!test || getEnclosingFunction(node) !== fn) return;
        // A loop whose condition is checked again after each await also counts, wherever it starts
        const isLoop = node.type === "WhileStatement" && offset(node, 1) >= offset(call, 1);
        const isBetween = offset(node, 0) >= from && offset(node, 0) <= offset(call, 0);
        if ((isLoop || isBetween) && LIFECYCLE_CHECK.test(context.sourceCode.getText(test))) found = true;
    });
    return found;
}

const rule: Rule = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow a component or disposable class subscribing after an `await` without checking it has not been torn down.",
        },
        messages: {
            subscribeAfterAwait:
                "This {{subscription}} is added after an asynchronous gap, which may end after unmount or dispose, when nothing will remove it. Check that it has not been torn down first, e.g. `if (this.unmounted) return;`.",
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                const subscription = getSubscription(context, node);
                if (!subscription) return;
                const owner = getEnclosingClass(node);
                if (!owner || !isLifecycleClass(context, owner)) return;
                const fn = getEnclosingFunction(node);
                if (!fn) return;

                const gap = getAsyncGap(fn, node);
                if (gap === null || hasLifecycleCheck(context, fn, gap, node)) return;
                context.report({ node, messageId: "subscribeAfterAwait", data: { subscription } });
            },
        };
    },
};

export default rule;

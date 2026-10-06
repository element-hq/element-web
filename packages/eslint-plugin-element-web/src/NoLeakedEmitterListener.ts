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
    getCalledMethodName,
    getCalledMethodObject,
    getClassTeardownScopes,
    getEffectCleanupScopes,
    getEnclosingClass,
    getEnclosingFunction,
    getParent,
    isEffectCallback,
    isFunction,
    isLifecycleClass,
    normalisedText,
    someInScopes,
    unwrap,
    walk,
} from "./ast.ts";

const ADD_METHODS = new Set(["on", "addListener"]);
const REMOVE_METHODS = new Set(["off", "removeListener"]);

/** Whether `handler` creates a new function each time it is evaluated, so it can never be passed to `off`. */
function isInlineHandler(handler: Node): boolean {
    handler = unwrap(handler);
    return isFunction(handler) || (handler.type === "CallExpression" && getCalledMethodName(handler) === "bind");
}

/**
 * Returns a comparable key for an event name. Events computed by a call, such as
 * `WidgetLayoutStore.emissionForRoom(room)`, are compared by the function called, because the
 * argument is usually spelt differently where the listener is removed.
 */
function eventKey(context: Context, event: Node): string {
    event = unwrap(event);
    return event.type === "CallExpression"
        ? `${normalisedText(context, event.callee)}()`
        : normalisedText(context, event);
}

/**
 * Whether `scopes` remove the listener `event`/`handler` from `emitter`, either explicitly with
 * `off`/`removeListener`, or by removing every listener from the same emitter.
 */
function hasRemoval(context: Context, scopes: Node[], emitter: string, event: string, handler: string): boolean {
    return someInScopes(scopes, (node) => {
        if (node.type !== "CallExpression") return false;
        const method = getCalledMethodName(node);
        if (method === "removeAllListeners") {
            const object = getCalledMethodObject(node);
            return !!object && normalisedText(context, object) === emitter;
        }
        return (
            !!method &&
            REMOVE_METHODS.has(method) &&
            node.arguments.length >= 2 &&
            eventKey(context, node.arguments[0]) === event &&
            normalisedText(context, node.arguments[1]) === handler
        );
    });
}

/**
 * Returns where the matching removal for a listener added by `call` must happen: the teardown of a class
 * with a teardown phase, or the cleanup of the effect which added it.
 */
function getTeardownScopes(context: Context, call: CallExpression): Node[] | null {
    const fn = getEnclosingFunction(call);
    if (fn && isEffectCallback(fn)) return getEffectCleanupScopes(fn);
    if (fn) {
        // A listener scoped to one function, removed in a `finally` block of that same function
        const finalizers: Node[] = [];
        walk(fn, (node) => {
            if (node.type === "TryStatement" && node.finalizer && getEnclosingFunction(node) === fn) {
                finalizers.push(node.finalizer);
            }
        });
        if (finalizers.length > 0) return finalizers;
    }

    const owner = getEnclosingClass(call);
    if (!owner || !isLifecycleClass(context, owner)) return null;
    // Only consider listeners added directly by the class's own methods, not by nested callbacks
    // which may belong to some other object's lifetime.
    const method = fn ? getParent(fn) : null;
    if (method?.type !== "MethodDefinition" && method?.type !== "PropertyDefinition") return null;
    // A class's own `on` method which forwards to an inner emitter is not a subscription
    if (method.key.type === "Identifier" && ADD_METHODS.has(method.key.name)) return null;
    return getClassTeardownScopes(owner);
}

const rule: Rule = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Require EventEmitter listeners added by a component, effect or disposable class to be removed on teardown.",
        },
        messages: {
            missingRemoval:
                "Listener for {{event}} added with `{{method}}` is not removed at teardown. Remove it with `off` or `removeListener` on unmount or dispose (or in the effect cleanup).",
            inlineHandler:
                "Listener for {{event}} is created inline, so `off` can never remove it. Store it in a stable reference, such as a class property, and remove that on unmount or dispose.",
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                const method = getCalledMethodName(node);
                if (!method || !ADD_METHODS.has(method) || node.arguments.length !== 2) return;
                // A used return value is typically an unsubscribe function, which is not this rule's concern
                if (getParent(node)?.type !== "ExpressionStatement") return;
                const emitterNode = getCalledMethodObject(node);
                if (!emitterNode) return;

                const scopes = getTeardownScopes(context, node);
                if (!scopes) return;

                const [eventNode, handlerNode] = node.arguments;
                const emitter = normalisedText(context, emitterNode);
                const event = eventKey(context, eventNode);
                const handler = normalisedText(context, handlerNode);
                if (isInlineHandler(handlerNode)) {
                    // An inline handler can only be removed by removing everything from the emitter
                    if (hasRemoval(context, scopes, emitter, event, "\0")) return;
                    context.report({
                        node: handlerNode,
                        messageId: "inlineHandler",
                        data: { event: context.sourceCode.getText(eventNode) },
                    });
                } else if (!hasRemoval(context, scopes, emitter, event, handler)) {
                    context.report({
                        node,
                        messageId: "missingRemoval",
                        data: { event: context.sourceCode.getText(eventNode), method },
                    });
                }
            },
        };
    },
};

export default rule;

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
    getParent,
    getSubscriptionTeardownScopes,
    getTargetName,
    normalisedText,
    someInScopes,
} from "./ast.ts";

/** A subscription API which returns a handle that must be passed back to release the subscription. */
interface Subscription {
    /** The method which subscribes and returns the handle. */
    add: string;
    /** The method which takes the handle and releases the subscription. */
    remove: string;
    /** Matches the source text of the object the methods are called on. */
    object: RegExp;
}

const SUBSCRIPTIONS: Subscription[] = [
    { add: "watchSetting", remove: "unwatchSetting", object: /^SettingsStore$/ },
    { add: "register", remove: "unregister", object: /(^|\.)(dis|dispatcher|defaultDispatcher|mxDispatcher)$/i },
];

/** Returns the subscription API which `call` subscribes with, if any. */
function getSubscription(context: Context, call: CallExpression): Subscription | null {
    const method = getCalledMethodName(call);
    const object = getCalledMethodObject(call);
    if (!method || !object) return null;
    const text = normalisedText(context, object);
    return SUBSCRIPTIONS.find((s) => s.add === method && s.object.test(text)) ?? null;
}

/**
 * Returns the name the handle returned by `call` is kept under, following it through array literals and
 * `push` calls, e.g. `watcherRefs` for `this.watcherRefs.push(SettingsStore.watchSetting(...))`.
 * Returns undefined when the handle is discarded and null when it is used in some other way, such as
 * being returned or passed to another function, which this rule cannot follow.
 */
function getHandleName(call: CallExpression): string | null | undefined {
    let node: Node = call;
    let parent = getParent(node);
    while (parent?.type === "ArrayExpression") {
        node = parent;
        parent = getParent(node);
    }
    switch (parent?.type) {
        case "ExpressionStatement":
            return undefined;
        case "AssignmentExpression":
            return parent.right === node ? getTargetName(parent.left) : null;
        case "VariableDeclarator":
            return parent.init === node ? getTargetName(parent.id) : null;
        case "PropertyDefinition":
            return parent.value === node && parent.key.type === "Identifier" ? parent.key.name : null;
        case "CallExpression": {
            const object = getCalledMethodName(parent) === "push" ? getCalledMethodObject(parent) : null;
            return object ? getTargetName(object) : null;
        }
        default:
            return null;
    }
}

/** Whether `scopes` call (or pass along) `remove`, and refer to `name`, to release the handle kept there. */
function hasRelease(scopes: Node[], remove: string, name: string): boolean {
    const removes = someInScopes(
        scopes,
        (node) =>
            node.type === "MemberExpression" &&
            !node.computed &&
            node.property.type === "Identifier" &&
            node.property.name === remove,
    );
    const refersToHandle = someInScopes(
        scopes,
        (node) =>
            (node.type === "Identifier" && node.name === name) ||
            (node.type === "MemberExpression" && node.property.type === "Identifier" && node.property.name === name),
    );
    return removes && refersToHandle;
}

const rule: Rule = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Require settings watchers and dispatcher registrations made by a component, effect, store or other disposable class to be released on teardown.",
        },
        messages: {
            discarded:
                "The handle returned by `{{method}}` is discarded, so it can never be released. Keep it and pass it to `{{remove}}` on teardown.",
            missingRelease:
                "`{{name}}` from `{{method}}` is not released at teardown. Pass it to `{{remove}}` on unmount, destroy or dispose (or in the effect cleanup).",
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                const subscription = getSubscription(context, node);
                if (!subscription) return;
                const scopes = getSubscriptionTeardownScopes(context, node);
                if (!scopes) return;

                const name = getHandleName(node);
                const data = { method: subscription.add, remove: subscription.remove, name: name ?? "" };
                if (name === undefined) {
                    context.report({ node, messageId: "discarded", data });
                } else if (name !== null && !hasRelease(scopes, subscription.remove, name)) {
                    context.report({ node, messageId: "missingRelease", data });
                }
            },
        };
    },
};

export default rule;

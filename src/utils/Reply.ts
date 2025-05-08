/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2023 The Matrix.org Foundation C.I.C.
 * Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type IContent, type IEventRelation, type MatrixEvent, THREAD_RELATION_TYPE } from "matrix-js-sdk/src/matrix";
import sanitizeHtml from "sanitize-html";

import { PERMITTED_URL_SCHEMES } from "./UrlUtils";

export function getParentEventId(ev?: MatrixEvent): string | undefined {
    if (!ev || ev.isRedacted()) return;
    if (ev.replyEventId) {
        return ev.replyEventId;
    }
}

// Part of Replies fallback support
export function stripPlainReply(body: string): string {
    // Removes lines beginning with `> ` until you reach one that doesn't.
    const lines = body.split("\n");
    while (lines.length && lines[0].startsWith("> ")) lines.shift();
    // Reply fallback has a blank line after it, so remove it to prevent leading newline
    if (lines[0] === "") lines.shift();
    return lines.join("\n");
}

// Part of Replies fallback support - MUST NOT BE RENDERED DIRECTLY - UNSAFE HTML
export function stripHTMLReply(html: string): string {
    // Sanitize the original HTML for inclusion in <mx-reply>.  We allow
    // any HTML, since the original sender could use special tags that we
    // don't recognize, but want to pass along to any recipients who do
    // recognize them -- recipients should be sanitizing before displaying
    // anyways.  However, we sanitize to 1) remove any mx-reply, so that we
    // don't generate a nested mx-reply, and 2) make sure that the HTML is
    // properly formatted (e.g. tags are closed where necessary)
    return sanitizeHtml(html, {
        allowedTags: false, // false means allow everything
        allowedAttributes: false,
        allowVulnerableTags: true, // silence xss warning, we won't be rendering directly this, so it is safe to do
        // we somehow can't allow all schemes, so we allow all that we
        // know of and mxc (for img tags)
        allowedSchemes: [...PERMITTED_URL_SCHEMES, "mxc"],
        exclusiveFilter: (frame) => frame.tag === "mx-reply",
    });
}

export function makeReplyMixIn(ev?: MatrixEvent): IEventRelation {
    if (!ev) return {};

    const mixin: IEventRelation = {
        "m.in_reply_to": {
            event_id: ev.getId(),
        },
    };

    if (ev.threadRootId) {
        mixin.is_falling_back = false;
    }

    return mixin;
}

export function shouldDisplayReply(event: MatrixEvent): boolean {
    if (event.isRedacted()) {
        return false;
    }

    const inReplyTo = event.getWireContent()?.["m.relates_to"]?.["m.in_reply_to"];
    if (!inReplyTo) {
        return false;
    }

    const relation = event.getRelation();
    if (relation?.rel_type === THREAD_RELATION_TYPE.name && relation?.is_falling_back) {
        return false;
    }

    return !!inReplyTo.event_id;
}

export function addReplyToMessageContent(content: IContent, replyToEvent: MatrixEvent): void {
    content["m.relates_to"] = {
        ...(content["m.relates_to"] || {}),
        ...makeReplyMixIn(replyToEvent),
    };
}

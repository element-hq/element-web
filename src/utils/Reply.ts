/*
 * Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>
 * Copyright 2023 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { IContent, IEventRelation, MatrixEvent } from "matrix-js-sdk/src/models/event";
import sanitizeHtml from "sanitize-html";
import escapeHtml from "escape-html";
import { THREAD_RELATION_TYPE } from "matrix-js-sdk/src/models/thread";
import { MsgType } from "matrix-js-sdk/src/@types/event";
import { M_BEACON_INFO } from "matrix-js-sdk/src/@types/beacon";
import { M_POLL_END, M_POLL_START } from "matrix-js-sdk/src/@types/polls";
import { PollStartEvent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";

import { PERMITTED_URL_SCHEMES } from "../HtmlUtils";
import { makeUserPermalink, RoomPermalinkCreator } from "./permalinks/Permalinks";
import { isSelfLocation } from "./location";

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

// Part of Replies fallback support
export function getNestedReplyText(
    ev: MatrixEvent,
    permalinkCreator?: RoomPermalinkCreator,
): { body: string; html: string } | null {
    if (!ev) return null;

    let {
        body,
        formatted_body: html,
        msgtype,
    } = ev.getContent<{
        body: string;
        msgtype?: string;
        formatted_body?: string;
    }>();
    if (getParentEventId(ev)) {
        if (body) body = stripPlainReply(body);
    }

    if (!body) body = ""; // Always ensure we have a body, for reasons.

    if (html) {
        // sanitize the HTML before we put it in an <mx-reply>
        html = stripHTMLReply(html);
    } else {
        // Escape the body to use as HTML below.
        // We also run a nl2br over the result to fix the fallback representation. We do this
        // after converting the text to safe HTML to avoid user-provided BR's from being converted.
        html = escapeHtml(body).replace(/\n/g, "<br/>");
    }

    // dev note: do not rely on `body` being safe for HTML usage below.

    const evLink = permalinkCreator?.forEvent(ev.getId()!);
    const userLink = makeUserPermalink(ev.getSender()!);
    const mxid = ev.getSender();

    if (M_BEACON_INFO.matches(ev.getType())) {
        const aTheir = isSelfLocation(ev.getContent()) ? "their" : "a";
        return {
            html:
                `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` +
                `<br>shared ${aTheir} live location.</blockquote></mx-reply>`,
            body: `> <${mxid}> shared ${aTheir} live location.\n\n`,
        };
    }

    if (M_POLL_START.matches(ev.getType())) {
        const extensibleEvent = ev.unstableExtensibleEvent as PollStartEvent;
        const question = extensibleEvent?.question?.text;
        return {
            html:
                `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` +
                `<br>Poll: ${question}</blockquote></mx-reply>`,
            body: `> <${mxid}> started poll: ${question}\n\n`,
        };
    }
    if (M_POLL_END.matches(ev.getType())) {
        return {
            html:
                `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` +
                `<br>Ended poll</blockquote></mx-reply>`,
            body: `> <${mxid}>Ended poll\n\n`,
        };
    }

    // This fallback contains text that is explicitly EN.
    switch (msgtype) {
        case MsgType.Text:
        case MsgType.Notice: {
            html =
                `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` +
                `<br>${html}</blockquote></mx-reply>`;
            const lines = body.trim().split("\n");
            if (lines.length > 0) {
                lines[0] = `<${mxid}> ${lines[0]}`;
                body = lines.map((line) => `> ${line}`).join("\n") + "\n\n";
            }
            break;
        }
        case MsgType.Image:
            html =
                `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` +
                `<br>sent an image.</blockquote></mx-reply>`;
            body = `> <${mxid}> sent an image.\n\n`;
            break;
        case MsgType.Video:
            html =
                `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` +
                `<br>sent a video.</blockquote></mx-reply>`;
            body = `> <${mxid}> sent a video.\n\n`;
            break;
        case MsgType.Audio:
            html =
                `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` +
                `<br>sent an audio file.</blockquote></mx-reply>`;
            body = `> <${mxid}> sent an audio file.\n\n`;
            break;
        case MsgType.File:
            html =
                `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` +
                `<br>sent a file.</blockquote></mx-reply>`;
            body = `> <${mxid}> sent a file.\n\n`;
            break;
        case MsgType.Location: {
            const aTheir = isSelfLocation(ev.getContent()) ? "their" : "a";
            html =
                `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` +
                `<br>shared ${aTheir} location.</blockquote></mx-reply>`;
            body = `> <${mxid}> shared ${aTheir} location.\n\n`;
            break;
        }
        case MsgType.Emote: {
            html =
                `<mx-reply><blockquote><a href="${evLink}">In reply to</a> * ` +
                `<a href="${userLink}">${mxid}</a><br>${html}</blockquote></mx-reply>`;
            const lines = body.trim().split("\n");
            if (lines.length > 0) {
                lines[0] = `* <${mxid}> ${lines[0]}`;
                body = lines.map((line) => `> ${line}`).join("\n") + "\n\n";
            }
            break;
        }
        default:
            return null;
    }

    return { body, html };
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

interface AddReplyOpts {
    permalinkCreator?: RoomPermalinkCreator;
    includeLegacyFallback: false;
}

interface IncludeLegacyFeedbackOpts {
    permalinkCreator?: RoomPermalinkCreator;
    includeLegacyFallback: true;
}

export function addReplyToMessageContent(
    content: IContent,
    replyToEvent: MatrixEvent,
    opts: AddReplyOpts | IncludeLegacyFeedbackOpts,
): void {
    content["m.relates_to"] = {
        ...(content["m.relates_to"] || {}),
        ...makeReplyMixIn(replyToEvent),
    };

    if (opts.includeLegacyFallback) {
        // Part of Replies fallback support - prepend the text we're sending with the text we're replying to
        const nestedReply = getNestedReplyText(replyToEvent, opts.permalinkCreator);
        if (nestedReply) {
            if (content.formatted_body) {
                content.formatted_body = nestedReply.html + content.formatted_body;
            }
            content.body = nestedReply.body + content.body;
        }
    }
}

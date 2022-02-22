/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { IEventRelation, MatrixEvent } from "matrix-js-sdk/src/models/event";
import { RelationType } from "matrix-js-sdk/src/@types/event";
import sanitizeHtml from "sanitize-html";
import escapeHtml from "escape-html";

import { PERMITTED_URL_SCHEMES } from "../HtmlUtils";
import { makeUserPermalink, RoomPermalinkCreator } from "./permalinks/Permalinks";

export function getParentEventId(ev: MatrixEvent): string | undefined {
    if (!ev || ev.isRedacted()) return;
    if (ev.replyEventId) {
        return ev.replyEventId;
    }
}

// Part of Replies fallback support
export function stripPlainReply(body: string): string {
    // Removes lines beginning with `> ` until you reach one that doesn't.
    const lines = body.split('\n');
    while (lines.length && lines[0].startsWith('> ')) lines.shift();
    // Reply fallback has a blank line after it, so remove it to prevent leading newline
    if (lines[0] === '') lines.shift();
    return lines.join('\n');
}

// Part of Replies fallback support
export function stripHTMLReply(html: string): string {
    // Sanitize the original HTML for inclusion in <mx-reply>.  We allow
    // any HTML, since the original sender could use special tags that we
    // don't recognize, but want to pass along to any recipients who do
    // recognize them -- recipients should be sanitizing before displaying
    // anyways.  However, we sanitize to 1) remove any mx-reply, so that we
    // don't generate a nested mx-reply, and 2) make sure that the HTML is
    // properly formatted (e.g. tags are closed where necessary)
    return sanitizeHtml(
        html,
        {
            allowedTags: false, // false means allow everything
            allowedAttributes: false,
            // we somehow can't allow all schemes, so we allow all that we
            // know of and mxc (for img tags)
            allowedSchemes: [...PERMITTED_URL_SCHEMES, 'mxc'],
            exclusiveFilter: (frame) => frame.tag === "mx-reply",
        },
    );
}

// Part of Replies fallback support
export function getNestedReplyText(
    ev: MatrixEvent,
    permalinkCreator: RoomPermalinkCreator,
): { body: string, html: string } | null {
    if (!ev) return null;

    let { body, formatted_body: html } = ev.getContent();
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
        html = escapeHtml(body).replace(/\n/g, '<br/>');
    }

    // dev note: do not rely on `body` being safe for HTML usage below.

    const evLink = permalinkCreator.forEvent(ev.getId());
    const userLink = makeUserPermalink(ev.getSender());
    const mxid = ev.getSender();

    // This fallback contains text that is explicitly EN.
    switch (ev.getContent().msgtype) {
        case 'm.text':
        case 'm.notice': {
            html = `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>`
                + `<br>${html}</blockquote></mx-reply>`;
            const lines = body.trim().split('\n');
            if (lines.length > 0) {
                lines[0] = `<${mxid}> ${lines[0]}`;
                body = lines.map((line) => `> ${line}`).join('\n') + '\n\n';
            }
            break;
        }
        case 'm.image':
            html = `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>`
                + `<br>sent an image.</blockquote></mx-reply>`;
            body = `> <${mxid}> sent an image.\n\n`;
            break;
        case 'm.video':
            html = `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>`
                + `<br>sent a video.</blockquote></mx-reply>`;
            body = `> <${mxid}> sent a video.\n\n`;
            break;
        case 'm.audio':
            html = `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>`
                + `<br>sent an audio file.</blockquote></mx-reply>`;
            body = `> <${mxid}> sent an audio file.\n\n`;
            break;
        case 'm.file':
            html = `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>`
                + `<br>sent a file.</blockquote></mx-reply>`;
            body = `> <${mxid}> sent a file.\n\n`;
            break;
        case 'm.emote': {
            html = `<mx-reply><blockquote><a href="${evLink}">In reply to</a> * `
                + `<a href="${userLink}">${mxid}</a><br>${html}</blockquote></mx-reply>`;
            const lines = body.trim().split('\n');
            if (lines.length > 0) {
                lines[0] = `* <${mxid}> ${lines[0]}`;
                body = lines.map((line) => `> ${line}`).join('\n') + '\n\n';
            }
            break;
        }
        default:
            return null;
    }

    return { body, html };
}

export function makeReplyMixIn(ev: MatrixEvent, renderIn?: string[]) {
    if (!ev) return {};

    const mixin: any = {
        'm.relates_to': {
            'm.in_reply_to': {
                'event_id': ev.getId(),
            },
        },
    };

    if (renderIn) {
        mixin['m.relates_to']['m.in_reply_to']['m.render_in'] = renderIn;
    }

    /**
     * If the event replied is part of a thread
     * Add the `m.thread` relation so that clients
     * that know how to handle that relation will
     * be able to render them more accurately
     */
    if (ev.isThreadRelation) {
        mixin['m.relates_to'] = {
            ...mixin['m.relates_to'],
            rel_type: RelationType.Thread,
            event_id: ev.threadRootId,
        };
    }

    return mixin;
}

export function shouldDisplayReply(event: MatrixEvent, renderTarget?: string): boolean {
    const parentExist = Boolean(getParentEventId(event));

    const relations = event.getRelation();
    const renderIn = relations?.["m.in_reply_to"]?.["m.render_in"] ?? [];

    const shouldRenderInTarget = !renderTarget || (renderIn.includes(renderTarget));

    return parentExist && shouldRenderInTarget;
}

export function getRenderInMixin(relation?: IEventRelation): string[] | undefined {
    if (relation?.rel_type === RelationType.Thread) {
        return [RelationType.Thread];
    }
}

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type FileContent, type MediaEventContent } from "matrix-js-sdk/src/types";

import { type MarkdownMedia } from "../@types/markdown-viewer";
import { MediaEventHelper } from "./MediaEventHelper";
import defaultDispatcher from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import { type OpenMarkdownViewerPayload } from "../dispatcher/payloads/OpenMarkdownViewerPayload";

export const MARKDOWN_MIMETYPES = new Set(["text/markdown", "text/x-markdown"]);

/**
 * Mimetypes a browser or client hands out when it does not know what a file is. For these the file
 * name is a better guide than the mimetype.
 */
const GENERIC_MIMETYPES = new Set(["text/plain", "application/octet-stream"]);

const MARKDOWN_EXTENSIONS = [".md", ".markdown"];

/**
 * Whether this event carries a Markdown file the viewer can open.
 *
 * A Markdown mimetype is enough on its own. Failing that, a `.md` or `.markdown` file name counts when
 * the mimetype is missing or generic, since many senders never label Markdown as such. Parameters after
 * the type itself (`text/markdown; charset=utf-8`) are ignored.
 */
export function isMarkdownEvent(mxEvent: MatrixEvent): boolean {
    if (!MediaEventHelper.isEligible(mxEvent)) return false;

    const content = mxEvent.getContent<MediaEventContent & FileContent>();
    const mimetype = content.info?.mimetype?.split(";")[0].trim().toLowerCase();
    if (mimetype && MARKDOWN_MIMETYPES.has(mimetype)) return true;
    if (mimetype && !GENERIC_MIMETYPES.has(mimetype)) return false;

    const name = (content.filename || content.body || "").toLowerCase();
    return MARKDOWN_EXTENSIONS.some((extension) => name.endsWith(extension));
}

/**
 * Adapt an event's media to the handle the viewer wants. `sourceBlob` decrypts transparently, so the
 * viewer never has to know whether the room is encrypted.
 */
export function markdownMediaForEvent(mxEvent: MatrixEvent, helper?: MediaEventHelper): MarkdownMedia | undefined {
    if (!isMarkdownEvent(mxEvent)) return;

    const mediaEventHelper = helper ?? new MediaEventHelper(mxEvent);
    const size = mxEvent.getContent<MediaEventContent>().info?.size;

    return {
        uri: mediaEventHelper.media.srcMxc,
        name: mediaEventHelper.fileName,
        size: typeof size === "number" && Number.isFinite(size) && size >= 0 ? size : undefined,
        blob: () => mediaEventHelper.sourceBlob.value,
    };
}

/**
 * Open the given event's Markdown file in the right panel of the room it belongs to.
 *
 * Dispatched rather than calling RightPanelStore directly: this module is reached from the message
 * body view models, and the store leads back round to the message bodies via SDKContextClass.
 */
export function openMarkdownViewer(mxEvent: MatrixEvent): void {
    defaultDispatcher.dispatch<OpenMarkdownViewerPayload>({
        action: Action.OpenMarkdownViewer,
        event: mxEvent,
    });
}

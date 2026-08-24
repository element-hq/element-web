/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";
import { type MediaEventContent } from "matrix-js-sdk/src/types";

/**
 * The document types we know how to render inside the media preview dialog.
 *
 * Anything not listed here has no in-app preview and keeps the existing
 * download-only behaviour.
 */
export enum FilePreviewKind {
    /** Rendered page-by-page onto a canvas with pdf.js. */
    Pdf = "pdf",
    /** Converted to sanitised HTML with mammoth. Only OOXML (.docx), not legacy .doc. */
    Docx = "docx",
}

/**
 * Which previewer the media preview dialog should mount.
 *
 * This is the superset of {@link FilePreviewKind} plus the image viewer, which predates the
 * document previewers and reaches the dialog by a different route: avatars and URL previews pass
 * a bare `src` with no event at all.
 */
export enum PreviewKind {
    Image = "image",
    Pdf = "pdf",
    Docx = "docx",
    /** We have nothing that can render this; offer the chrome and a download button. */
    Unsupported = "unsupported",
}

const MIMETYPES: Record<string, FilePreviewKind> = {
    "application/pdf": FilePreviewKind.Pdf,
    "application/x-pdf": FilePreviewKind.Pdf,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": FilePreviewKind.Docx,
};

const EXTENSIONS: Record<string, FilePreviewKind> = {
    pdf: FilePreviewKind.Pdf,
    docx: FilePreviewKind.Docx,
};

function extensionOf(name?: string): string | undefined {
    if (!name) return undefined;
    const dot = name.lastIndexOf(".");
    if (dot < 0 || dot === name.length - 1) return undefined;
    return name.slice(dot + 1).toLowerCase();
}

/**
 * Work out which previewer, if any, can render the given media content.
 *
 * The mimetype claimed by the event is preferred, but plenty of clients send files as
 * `application/octet-stream`, so we fall back to the filename extension. Neither source is
 * trusted to be truthful — the previewers parse the bytes themselves and fail gracefully.
 *
 * @param content - the content of an `m.file` (or similar) event
 * @returns the preview kind, or `null` when the file cannot be previewed
 */
export function getFilePreviewKind(content: MediaEventContent): FilePreviewKind | null {
    const mimetype = content.info?.mimetype?.split(";")[0].trim().toLowerCase();
    if (mimetype && MIMETYPES[mimetype]) return MIMETYPES[mimetype];

    const extension = extensionOf(content.filename ?? content.body);
    if (extension && EXTENSIONS[extension]) return EXTENSIONS[extension];

    return null;
}

/**
 * Whether the given event is a file message that the preview dialog can display.
 *
 * @param mxEvent - the event to test
 */
export function canPreviewFile(mxEvent: MatrixEvent): boolean {
    if (mxEvent.isRedacted()) return false;

    const content = mxEvent.getContent<MediaEventContent>();
    if (content.msgtype !== MsgType.File) return false;

    return getFilePreviewKind(content) !== null;
}

/**
 * Choose the previewer for a dialog opened on the given event.
 *
 * Callers that pass no event at all — avatars, URL previews — are always showing an image, so
 * that is the default. Only `m.file` consults the document previewers; anything else keeps the
 * image viewer it has always used.
 *
 * @param mxEvent - the event being previewed, if the preview came from a timeline message
 */
export function getPreviewKind(mxEvent?: MatrixEvent): PreviewKind {
    if (!mxEvent) return PreviewKind.Image;

    const content = mxEvent.getContent<MediaEventContent>();
    if (content.msgtype !== MsgType.File) return PreviewKind.Image;

    switch (getFilePreviewKind(content)) {
        case FilePreviewKind.Pdf:
            return PreviewKind.Pdf;
        case FilePreviewKind.Docx:
            return PreviewKind.Docx;
        default:
            return PreviewKind.Unsupported;
    }
}

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { _t } from "../languageHandler";
import { isPdfEvent, openPdfViewer } from "./pdfViewer";
import { isMarkdownEvent, openMarkdownViewer } from "./markdownViewer";

/** A way of opening an attachment in the right panel, offered on its timeline tile. */
export interface AttachmentViewer {
    /** Label for the action that opens the viewer. */
    openLabel: string;
    /** Opens the attachment in its viewer. */
    open: () => void;
}

/**
 * The viewer, if any, that can open this event's attachment. Every viewer sits behind the document
 * previews lab, which is the caller's to check.
 */
export function attachmentViewerForEvent(mxEvent: MatrixEvent): AttachmentViewer | undefined {
    if (isPdfEvent(mxEvent)) {
        return { openLabel: _t("pdf_viewer|open"), open: () => openPdfViewer(mxEvent) };
    }
    if (isMarkdownEvent(mxEvent)) {
        return { openLabel: _t("markdown_viewer|open"), open: () => openMarkdownViewer(mxEvent) };
    }

    return undefined;
}

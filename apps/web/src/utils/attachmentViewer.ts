/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { _t } from "../languageHandler";
import { isPdfEvent, openPdfViewer } from "./pdfViewer";
import { isMarkdownEvent, openMarkdownViewer } from "./markdownViewer";

/** Which attachment viewer labs are on. Read by the views, so the view models need no settings access. */
export interface AttachmentViewerLabs {
    /** Whether the PDF viewer lab is on. */
    pdfViewerEnabled: boolean;
    /** Whether the Markdown viewer lab is on. */
    markdownViewerEnabled: boolean;
}

/** A way of opening an attachment in the right panel, offered on its timeline tile. */
export interface AttachmentViewer {
    /** Label for the action that opens the viewer. */
    openLabel: string;
    /** Opens the attachment in its viewer. */
    open: () => void;
}

/**
 * The viewer, if any, that can open this event's attachment. A viewer behind a lab is only offered
 * while that lab is on.
 */
export function attachmentViewerForEvent(
    mxEvent: MatrixEvent,
    labs: AttachmentViewerLabs,
): AttachmentViewer | undefined {
    if (labs.pdfViewerEnabled && isPdfEvent(mxEvent)) {
        return { openLabel: _t("pdf_viewer|open"), open: () => openPdfViewer(mxEvent) };
    }
    if (labs.markdownViewerEnabled && isMarkdownEvent(mxEvent)) {
        return { openLabel: _t("markdown_viewer|open"), open: () => openMarkdownViewer(mxEvent) };
    }

    return undefined;
}

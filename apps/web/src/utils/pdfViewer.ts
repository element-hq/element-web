/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type MediaEventContent } from "matrix-js-sdk/src/types";

import { type PdfMedia } from "../@types/pdf-viewer";
import { MediaEventHelper } from "./MediaEventHelper";
import RightPanelStore from "../stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../stores/right-panel/RightPanelStorePhases";

export const PDF_MIMETYPE = "application/pdf";

/**
 * Whether this event carries a PDF the viewer can open. Parameters after the type itself
 * (`application/pdf; version=1.7`) are stripped, since they say nothing about whether we can render it.
 */
export function isPdfEvent(mxEvent: MatrixEvent): boolean {
    if (!MediaEventHelper.isEligible(mxEvent)) return false;
    const mimetype = mxEvent.getContent<MediaEventContent>().info?.mimetype;
    return mimetype?.split(";")[0].trim().toLowerCase() === PDF_MIMETYPE;
}

/**
 * Adapt an event's media to the handle the viewer wants. `sourceBlob` decrypts transparently, so the
 * viewer never has to know whether the room is encrypted.
 */
export function pdfMediaForEvent(mxEvent: MatrixEvent, helper?: MediaEventHelper): PdfMedia | undefined {
    if (!isPdfEvent(mxEvent)) return;

    const mediaEventHelper = helper ?? new MediaEventHelper(mxEvent);

    return {
        uri: mediaEventHelper.media.srcMxc,
        name: mediaEventHelper.fileName,
        blob: () => mediaEventHelper.sourceBlob.value,
    };
}

/**
 * Open the given event's PDF in the right panel of the room it belongs to.
 */
export function openPdfViewer(mxEvent: MatrixEvent): void {
    RightPanelStore.instance.setCard(
        { phase: RightPanelPhases.PdfViewer, state: { pdfViewerEvent: mxEvent } },
        true,
        mxEvent.getRoomId(),
    );
}

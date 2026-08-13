/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type PdfViewerCardSnapshot,
    type PdfViewerCardViewModel as PdfViewerCardViewModelInterface,
} from "@element-hq/web-shared-components";

import { _t } from "../../../languageHandler";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";

export interface PdfViewerCardViewModelProps {
    /** The room the attachment was sent in. */
    room: Room;
    /** The id of the event holding the PDF attachment. */
    eventId: string;
}

/**
 * View model for the right panel PDF viewer card: fetches the event, downloads and decrypts
 * the attachment it points at, and hands the resulting object URL over to the view.
 */
export class PdfViewerCardViewModel
    extends BaseViewModel<PdfViewerCardSnapshot, PdfViewerCardViewModelProps>
    implements PdfViewerCardViewModelInterface
{
    public constructor(props: PdfViewerCardViewModelProps) {
        // Downloading the file is pointless if the browser has no viewer to hand it to.
        const canViewPdfs = navigator.pdfViewerEnabled;
        super(
            props,
            canViewPdfs
                ? { status: "loading" }
                : { status: "failed", message: _t("right_panel|pdf_viewer|browser_not_supported") },
        );

        if (canViewPdfs) {
            this.load().catch((error) => {
                logger.error("Failed to load the PDF for the viewer card", error);
                if (this.isDisposed) return;
                this.snapshot.set({ status: "failed", message: _t("right_panel|pdf_viewer|load_failed") });
            });
        }
    }

    private async load(): Promise<void> {
        const { room, eventId } = this.props;
        const client = room.client;

        const event = new MatrixEvent(await client.fetchRoomEvent(room.roomId, eventId));
        await client.decryptEventIfNeeded(event, { emit: false });
        // An event without media has nothing for us to show, so stay in the loading state.
        if (this.isDisposed || !MediaEventHelper.isEligible(event)) return;

        const helper = new MediaEventHelper(event);
        try {
            const blob = await helper.sourceBlob.value;
            if (this.isDisposed) return;

            const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
            this.snapshot.set({ status: "loaded", url });
        } finally {
            helper.destroy();
        }
    }

    public dispose(): void {
        super.dispose();
        // The view is going away, so the URL the iframe was reading from can go too.
        const snapshot = this.getSnapshot();
        if (snapshot.status === "loaded") URL.revokeObjectURL(snapshot.url);
    }
}

/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { type RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { getPreviewKind, PreviewKind } from "./previewTypes";
import ImagePreview from "./ImagePreview";
import PdfPreview from "./PdfPreview";
import DocxPreview from "./DocxPreview";
import UnsupportedPreview from "./UnsupportedPreview";

export interface MediaPreviewDialogProps {
    /**
     * Direct URL to the media. Required for images, which are shown straight from a URL; the
     * document previewers ignore it and fetch the bytes from the event themselves.
     */
    src?: string;
    /** The main title ('name') for the media. */
    name?: string;
    /** The link (if any) applied to the name of the media. */
    link?: string;
    /** Width of the image src in pixels. */
    width?: number;
    /** Height of the image src in pixels. */
    height?: number;
    /** Size of the media in bytes. */
    fileSize?: number;

    /**
     * The event being previewed, if any. Used for event-specific chrome — sender, timestamp,
     * message options — and to pick the previewer. Avatars and URL previews pass none, which is
     * why every field here is optional.
     */
    mxEvent?: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;

    /** Where the thumbnail sits on screen, so the image can animate out from it. */
    thumbnailInfo?: {
        positionX: number;
        positionY: number;
        width: number;
        height: number;
    };

    onFinished: () => void;
}

/**
 * The single entry point for full-screen media previews.
 *
 * Every previewer renders the same {@link MediaPreviewShell} chrome and differs only in its
 * toolbar controls and its content, so adding a format means writing one previewer and
 * registering it here — nothing about the surrounding dialog needs to change.
 */
export default function MediaPreviewDialog(props: MediaPreviewDialogProps): JSX.Element {
    const { src, mxEvent, permalinkCreator, onFinished } = props;

    switch (getPreviewKind(mxEvent)) {
        case PreviewKind.Pdf:
            return <PdfPreview mxEvent={mxEvent!} permalinkCreator={permalinkCreator} onFinished={onFinished} />;

        case PreviewKind.Docx:
            return <DocxPreview mxEvent={mxEvent!} permalinkCreator={permalinkCreator} onFinished={onFinished} />;

        case PreviewKind.Image:
            // An image with nothing to show is not an image; fall through to the download pane
            // rather than mounting the viewer on an empty src.
            if (src) return <ImagePreview {...props} src={src} />;
            return <UnsupportedPreview mxEvent={mxEvent} permalinkCreator={permalinkCreator} onFinished={onFinished} />;

        case PreviewKind.Unsupported:
        default:
            return <UnsupportedPreview mxEvent={mxEvent} permalinkCreator={permalinkCreator} onFinished={onFinished} />;
    }
}

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX } from "react";
import type { MediaHandle } from "@element-hq/element-web-module-api";
import BaseCard from "./BaseCard";
import ErrorBoundary from "../elements/ErrorBoundary";
import type { RegisteredFileViewer } from "../../../modules/FileViewerApi";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import type RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import type { MediaPreviewEntryButton } from "@element-hq/web-shared-components";
import type { MatrixEvent } from "matrix-js-sdk/src/matrix";

export interface FileViewerCardState {
    /**
     * Viewer in use of viewing
     */
    viewer: RegisteredFileViewer;
    /**
     * The media that is being viewed
     */
    media: MediaHandle;
}

export interface FileViewerCardProps extends FileViewerCardState {
    /** called when the card is closed */
    onClose: () => void;
}

export function FileViewerCard({ viewer, media, onClose }: FileViewerCardProps): JSX.Element {
    return (
        <BaseCard onClose={onClose} header={viewer.options.cardHeader(media)}>
            <ErrorBoundary>{viewer && viewer.render({ media, onClose })}</ErrorBoundary>
        </BaseCard>
    );
}

/**
 * Creates a MediaPreviewEntryButton for opening the file viewer
 */
export function fileViewerOpenButton({
    viewer,
    media,
    mxEvent,
    rightPanelStore,
}: {
    /** the viewer the button opens */
    viewer: RegisteredFileViewer;
    /** media to open when clicked */
    media: MediaHandle;
    /** source event */
    mxEvent: MatrixEvent;
    /** which RightPanelStore to open the file in */
    rightPanelStore: RightPanelStore;
}): MediaPreviewEntryButton {
    return {
        label: viewer.options.buttonText,
        icon: viewer.options.buttonIcon,
        onClick: () =>
            rightPanelStore.setCard({
                phase: RightPanelPhases.FileViewer,
                state: {
                    fileViewer: viewer,
                    fileViewerMedia: media,
                    fileViewerSourceEvent: mxEvent,
                },
            }),
    };
}

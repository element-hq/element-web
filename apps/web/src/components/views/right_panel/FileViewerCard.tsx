/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX } from "react";
import type { MediaHandle } from "@element-hq/element-web-module-api";
import BaseCard from "./BaseCard";
import ErrorBoundary from "../elements/ErrorBoundary";
import { mediaHandleId, type RegisteredFileViewer } from "../../../modules/FileViewerApi";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import type RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import type { MediaPreviewEntryButton } from "@element-hq/web-shared-components";
import type { MatrixEvent } from "matrix-js-sdk/src/matrix";
import type { FileViewerCardState } from "../../../stores/right-panel/RightPanelStoreIPanelState";
import { ModuleApi } from "../../../modules/Api";

export interface FileViewerCardProps extends FileViewerCardState {
    /** called when the card is closed */
    onClose: () => void;
}

/**
 * Right panel card for a file viewer registered through the file viewer module api
 */
export function FileViewerCard({ viewer, media, mxEvent, onClose }: FileViewerCardProps): JSX.Element {
    const Viewer = viewer.render;
    return (
        <BaseCard key={mediaHandleId(media, mxEvent)} onClose={onClose} header={viewer.options.cardHeader(media)}>
            <ErrorBoundary>
                <Viewer media={media} onClose={onClose} />
            </ErrorBoundary>
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
                    fileViewer: { viewer, media, mxEvent },
                },
            }),
    };
}

/**
 * Creates a MediaPreviewEntryButton for every registered file viewer that can open the media
 *
 * @param media media to find viewers for, or undefined if the event has no viewable media
 * @param mxEvent source event
 * @param rightPanelStore which RightPanelStore to open the file in
 */
export function fileViewerButtonsFor(
    media: MediaHandle | undefined,
    mxEvent: MatrixEvent,
    rightPanelStore: RightPanelStore,
): MediaPreviewEntryButton[] {
    if (!media) return [];
    return ModuleApi.instance.fileViewer
        .getViewersFor(media)
        .map((viewer) => fileViewerOpenButton({ viewer, media, mxEvent, rightPanelStore }));
}

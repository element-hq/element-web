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
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import type { MediaPreviewEntryButton } from "@element-hq/web-shared-components";
import type { MatrixEvent } from "matrix-js-sdk/src/matrix";

export interface FileViewerCardState {
    viewer: RegisteredFileViewer;
    media: MediaHandle;
}

export function FileViewerCard({ viewer, media, onClose }: FileViewerCardState & { onClose: () => void }): JSX.Element {
    return (
        <BaseCard onClose={onClose} header={viewer.options.cardHeader} withoutScrollContainer>
            <ErrorBoundary>{viewer && viewer.render({ media, onClose })}</ErrorBoundary>
        </BaseCard>
    );
}

export function fileViewerOpenButton({
    viewer,
    media,
    mxEvent,
}: {
    viewer: RegisteredFileViewer;
    media: MediaHandle;
    mxEvent: MatrixEvent;
}): MediaPreviewEntryButton {
    return {
        label: viewer.options.buttonText,
        icon: viewer.options.buttonIcon,
        onClick: () =>
            RightPanelStore.instance.setCard({
                phase: RightPanelPhases.FileViewer,
                state: {
                    fileViewer: viewer,
                    fileViewerMedia: media,
                    fileViewerSourceEvent: mxEvent,
                },
            }),
    };
}

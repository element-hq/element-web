/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React from "react";
import { MediaHandle } from "@element-hq/element-web-module-api";
import BaseCard from "./BaseCard";
import ErrorBoundary from "../elements/ErrorBoundary";
import { RegisteredFileViewer } from "../../../modules/FileViewerApi";

export interface FileViewerCardState {
    viewer: RegisteredFileViewer;
    media: MediaHandle;
}

export function FileViewerCard({ viewer, media, onClose }: FileViewerCardState & { onClose: () => void }) {
    return (
        <BaseCard onClose={onClose} header={viewer.options.cardHeader}>
            <ErrorBoundary>{viewer && viewer.render({ media, onClose })}</ErrorBoundary>
        </BaseCard>
    );
}

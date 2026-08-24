/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback, useState } from "react";
import { ZoomInIcon, ZoomOutIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../../languageHandler";
import AccessibleButton from "../AccessibleButton";

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 4;
const ZOOM_STEP = 0.2;
const DEFAULT_ZOOM = 1;

export interface Zoom {
    zoom: number;
    zoomIn: () => void;
    zoomOut: () => void;
}

/**
 * Simple stepped zoom, for the document previewers.
 *
 * The image previewer deliberately does not use this: its zoom is continuous, anchored on the
 * cursor and bounded by the image's natural size, so it keeps its own.
 */
export function useZoom(): Zoom {
    const [zoom, setZoom] = useState(DEFAULT_ZOOM);
    const zoomIn = useCallback(() => setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM)), []);
    const zoomOut = useCallback(() => setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM)), []);
    return { zoom, zoomIn, zoomOut };
}

interface Props extends Zoom {
    min: number;
    max: number;
}

/** The zoom in/out pair shared by the document previewers' toolbars. */
export function ZoomControls({ zoom, zoomIn, zoomOut, min, max }: Props): JSX.Element {
    return (
        <>
            <AccessibleButton
                className="mx_MediaPreview_button"
                title={_t("action|zoom_out")}
                onClick={zoomOut}
                disabled={zoom <= min}
            >
                <ZoomOutIcon />
            </AccessibleButton>
            <AccessibleButton
                className="mx_MediaPreview_button"
                title={_t("action|zoom_in")}
                onClick={zoomIn}
                disabled={zoom >= max}
            >
                <ZoomInIcon />
            </AccessibleButton>
        </>
    );
}

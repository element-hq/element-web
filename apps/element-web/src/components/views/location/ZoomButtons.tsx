/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { PlusIcon, MinusIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import type * as maplibregl from "maplibre-gl";
import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";

interface Props {
    map: maplibregl.Map;
}

const ZoomButtons: React.FC<Props> = ({ map }) => {
    const onZoomIn = (): void => {
        map.zoomIn();
    };

    const onZoomOut = (): void => {
        map.zoomOut();
    };

    return (
        <div className="mx_ZoomButtons">
            <AccessibleButton
                onClick={onZoomIn}
                data-testid="map-zoom-in-button"
                title={_t("action|zoom_in")}
                className="mx_ZoomButtons_button"
            >
                <PlusIcon className="mx_ZoomButtons_icon" />
            </AccessibleButton>
            <AccessibleButton
                onClick={onZoomOut}
                data-testid="map-zoom-out-button"
                title={_t("action|zoom_out")}
                className="mx_ZoomButtons_button"
            >
                <MinusIcon className="mx_ZoomButtons_icon" />
            </AccessibleButton>
        </div>
    );
};

export default ZoomButtons;

/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import * as maplibregl from "maplibre-gl";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import { Icon as PlusIcon } from "../../../../res/img/element-icons/plus-button.svg";
import { Icon as MinusIcon } from "../../../../res/img/element-icons/minus-button.svg";

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
                title={_t("Zoom in")}
                className="mx_ZoomButtons_button"
            >
                <PlusIcon className="mx_ZoomButtons_icon" />
            </AccessibleButton>
            <AccessibleButton
                onClick={onZoomOut}
                data-testid="map-zoom-out-button"
                title={_t("Zoom out")}
                className="mx_ZoomButtons_button"
            >
                <MinusIcon className="mx_ZoomButtons_icon" />
            </AccessibleButton>
        </div>
    );
};

export default ZoomButtons;

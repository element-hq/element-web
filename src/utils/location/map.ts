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

import * as maplibregl from "maplibre-gl";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../languageHandler";
import { findMapStyleUrl } from "./findMapStyleUrl";
import { LocationShareError } from "./LocationShareErrors";

export const createMap = (
    client: MatrixClient,
    interactive: boolean,
    bodyId: string,
    onError?: (error: Error) => void,
): maplibregl.Map => {
    try {
        const styleUrl = findMapStyleUrl(client);

        const map = new maplibregl.Map({
            container: bodyId,
            style: styleUrl,
            zoom: 15,
            interactive,
            attributionControl: false,
            locale: {
                "AttributionControl.ToggleAttribution": _t("location_sharing|toggle_attribution"),
                "AttributionControl.MapFeedback": _t("location_sharing|map_feedback"),
                "FullscreenControl.Enter": _t("action|enter_fullscreen"),
                "FullscreenControl.Exit": _t("action|exit_fullscreeen"),
                "GeolocateControl.FindMyLocation": _t("location_sharing|find_my_location"),
                "GeolocateControl.LocationNotAvailable": _t("location_sharing|location_not_available"),
                "LogoControl.Title": _t("location_sharing|mapbox_logo"),
                "NavigationControl.ResetBearing": _t("location_sharing|reset_bearing"),
                "NavigationControl.ZoomIn": _t("action|zoom_in"),
                "NavigationControl.ZoomOut": _t("action|zoom_out"),
            },
        });
        map.addControl(new maplibregl.AttributionControl(), "top-right");

        map.on("error", (e) => {
            logger.error("Failed to load map: check map_style_url in config.json has a valid URL and API key", e.error);
            onError?.(new Error(LocationShareError.MapStyleUrlNotReachable));
        });

        return map;
    } catch (e) {
        logger.error("Failed to render map", e);
        const errorMessage = (e as Error)?.message;
        if (errorMessage.includes("Failed to initialize WebGL")) throw new Error(LocationShareError.WebGLNotEnabled);
        throw e;
    }
};

export const createMarker = (coords: GeolocationCoordinates, element: HTMLElement): maplibregl.Marker => {
    const marker = new maplibregl.Marker({
        element,
        anchor: "bottom",
        offset: [0, -1],
    }).setLngLat({ lon: coords.longitude, lat: coords.latitude });
    return marker;
};

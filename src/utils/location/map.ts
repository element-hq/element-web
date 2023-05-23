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
import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { M_LOCATION } from "matrix-js-sdk/src/@types/location";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../languageHandler";
import { parseGeoUri } from "./parseGeoUri";
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
                "AttributionControl.ToggleAttribution": _t("Toggle attribution"),
                "AttributionControl.MapFeedback": _t("Map feedback"),
                "FullscreenControl.Enter": _t("Enter fullscreen"),
                "FullscreenControl.Exit": _t("Exit fullscreen"),
                "GeolocateControl.FindMyLocation": _t("Find my location"),
                "GeolocateControl.LocationNotAvailable": _t("Location not available"),
                "LogoControl.Title": _t("Mapbox logo"),
                "NavigationControl.ResetBearing": _t("Reset bearing to north"),
                "NavigationControl.ZoomIn": _t("Zoom in"),
                "NavigationControl.ZoomOut": _t("Zoom out"),
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

export const makeMapSiteLink = (coords: GeolocationCoordinates): string => {
    return (
        "https://www.openstreetmap.org/" +
        `?mlat=${coords.latitude}` +
        `&mlon=${coords.longitude}` +
        `#map=16/${coords.latitude}/${coords.longitude}`
    );
};

export const createMapSiteLinkFromEvent = (event: MatrixEvent): string | null => {
    const content = event.getContent();
    const mLocation = content[M_LOCATION.name];
    if (mLocation !== undefined) {
        const uri = mLocation["uri"];
        if (uri !== undefined) {
            const geoCoords = parseGeoUri(uri);
            return geoCoords ? makeMapSiteLink(geoCoords) : null;
        }
    } else {
        const geoUri = content["geo_uri"];
        if (geoUri) {
            const geoCoords = parseGeoUri(geoUri);
            return geoCoords ? makeMapSiteLink(geoCoords) : null;
        }
    }
    return null;
};

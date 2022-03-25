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

import maplibregl from "maplibre-gl";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { M_LOCATION } from "matrix-js-sdk/src/@types/location";
import { logger } from "matrix-js-sdk/src/logger";

import { parseGeoUri } from "./parseGeoUri";
import { findMapStyleUrl } from "./findMapStyleUrl";
import { LocationShareError } from "./LocationShareErrors";

export const createMap = (
    coords: GeolocationCoordinates,
    interactive: boolean,
    bodyId: string,
    markerId: string,
    onError: (error: Error) => void,
): maplibregl.Map => {
    try {
        const styleUrl = findMapStyleUrl();
        const coordinates = new maplibregl.LngLat(coords.longitude, coords.latitude);

        const map = new maplibregl.Map({
            container: bodyId,
            style: styleUrl,
            center: coordinates,
            zoom: 15,
            interactive,
        });

        new maplibregl.Marker({
            element: document.getElementById(markerId),
            anchor: 'bottom',
            offset: [0, -1],
        })
            .setLngLat(coordinates)
            .addTo(map);

        map.on('error', (e) => {
            logger.error(
                "Failed to load map: check map_style_url in config.json has a "
                + "valid URL and API key",
                e.error,
            );
            onError(new Error(LocationShareError.MapStyleUrlNotReachable));
        });

        return map;
    } catch (e) {
        logger.error("Failed to render map", e);
        onError(e);
    }
};

const makeLink = (coords: GeolocationCoordinates): string => {
    return (
        "https://www.openstreetmap.org/" +
        `?mlat=${coords.latitude}` +
        `&mlon=${coords.longitude}` +
        `#map=16/${coords.latitude}/${coords.longitude}`
    );
};

export const createMapSiteLink = (event: MatrixEvent): string => {
    const content: Object = event.getContent();
    const mLocation = content[M_LOCATION.name];
    if (mLocation !== undefined) {
        const uri = mLocation["uri"];
        if (uri !== undefined) {
            return makeLink(parseGeoUri(uri));
        }
    } else {
        const geoUri = content["geo_uri"];
        if (geoUri) {
            return makeLink(parseGeoUri(geoUri));
        }
    }
    return null;
};

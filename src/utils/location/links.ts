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

import { MatrixEvent, M_LOCATION } from "matrix-js-sdk/src/matrix";

import { parseGeoUri } from "./parseGeoUri";

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

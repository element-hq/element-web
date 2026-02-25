/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, M_LOCATION } from "matrix-js-sdk/src/matrix";

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

/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export const parseGeoUri = (uri: string): GeolocationCoordinates | undefined => {
    function parse(s: string): number | null {
        const ret = parseFloat(s);
        if (Number.isNaN(ret)) {
            return null;
        } else {
            return ret;
        }
    }

    const m = uri.match(/^\s*geo:(.*?)\s*$/);
    if (!m) return;
    const parts = m[1].split(";");
    const coords = parts[0].split(",");
    let uncertainty: number | null | undefined = undefined;
    for (const param of parts.slice(1)) {
        const m = param.match(/u=(.*)/);
        if (m) uncertainty = parse(m[1]);
    }
    const latitude = parse(coords[0]);
    const longitude = parse(coords[1]);

    if (latitude === null || longitude === null) {
        return;
    }

    const geoCoords = {
        latitude: latitude!,
        longitude: longitude!,
        altitude: parse(coords[2]),
        accuracy: uncertainty!,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
    };

    return {
        toJSON: () => geoCoords,
        ...geoCoords,
    };
};

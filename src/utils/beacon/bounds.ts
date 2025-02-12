/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Beacon } from "matrix-js-sdk/src/matrix";

import { filterBoolean } from "../arrays";
import { parseGeoUri } from "../location";

export type Bounds = {
    north: number;
    east: number;
    west: number;
    south: number;
};

/**
 * Get the geo bounds of given list of beacons
 *
 * Latitude:
 * equator: 0, North pole: 90, South pole -90
 * Longitude:
 * Prime Meridian (Greenwich): 0
 * east of Greenwich has a positive longitude, max 180
 * west of Greenwich has a negative longitude, min -180
 */
export const getBeaconBounds = (beacons: Beacon[]): Bounds | undefined => {
    const coords = filterBoolean<GeolocationCoordinates>(
        beacons.map((beacon) =>
            !!beacon.latestLocationState?.uri ? parseGeoUri(beacon.latestLocationState.uri) : undefined,
        ),
    );

    if (!coords.length) {
        return;
    }

    // sort descending
    const sortedByLat = [...coords].sort((left, right) => right.latitude - left.latitude);
    const sortedByLong = [...coords].sort((left, right) => right.longitude - left.longitude);

    if (sortedByLat.length < 1 || sortedByLong.length < 1) return;

    return {
        north: sortedByLat[0]!.latitude,
        south: sortedByLat[sortedByLat.length - 1]!.latitude,
        east: sortedByLong[0]!.longitude,
        west: sortedByLong[sortedByLong.length - 1]!.longitude,
    };
};

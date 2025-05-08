/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type MatrixEvent, getBeaconInfoIdentifier } from "matrix-js-sdk/src/matrix";

/**
 * Beacons should only have shareable locations (open in external mapping tool, forward)
 * when they are live and have a location
 * If not live, returns null
 */
export const getShareableLocationEventForBeacon = (event: MatrixEvent, cli: MatrixClient): MatrixEvent | null => {
    const room = cli.getRoom(event.getRoomId());
    const beacon = room?.currentState.beacons?.get(getBeaconInfoIdentifier(event));
    const latestLocationEvent = beacon?.latestLocationEvent;

    if (beacon?.isLive && latestLocationEvent) {
        return latestLocationEvent;
    }
    return null;
};

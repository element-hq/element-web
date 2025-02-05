/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Beacon, type Room, RoomStateEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { useEventEmitterState } from "../../hooks/useEventEmitter";

/**
 * Returns an array of all live beacon ids for a given room
 *
 * Beacons are removed from array when they become inactive
 */
export const useLiveBeacons = (roomId: Room["roomId"], matrixClient: MatrixClient): Beacon[] => {
    const room = matrixClient.getRoom(roomId);

    const liveBeacons = useEventEmitterState(
        room?.currentState,
        RoomStateEvent.BeaconLiveness,
        () =>
            room?.currentState?.liveBeaconIds.map(
                (beaconIdentifier) => room.currentState.beacons.get(beaconIdentifier)!,
            ) || [],
    );

    return liveBeacons;
};

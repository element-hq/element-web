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

import { Beacon, Room, RoomStateEvent, MatrixClient } from "matrix-js-sdk/src/matrix";

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

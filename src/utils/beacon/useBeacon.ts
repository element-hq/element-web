/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useContext, useEffect, useState } from "react";
import { type Beacon, BeaconEvent, type MatrixEvent, getBeaconInfoIdentifier } from "matrix-js-sdk/src/matrix";

import MatrixClientContext from "../../contexts/MatrixClientContext";
import { useEventEmitterState } from "../../hooks/useEventEmitter";

export const useBeacon = (beaconInfoEvent: MatrixEvent): Beacon | undefined => {
    const matrixClient = useContext(MatrixClientContext);
    const [beacon, setBeacon] = useState<Beacon>();

    useEffect(() => {
        const roomId = beaconInfoEvent.getRoomId();
        const beaconIdentifier = getBeaconInfoIdentifier(beaconInfoEvent);

        const room = matrixClient?.getRoom(roomId);
        const beaconInstance = room?.currentState.beacons.get(beaconIdentifier);

        // TODO could this be less stupid?

        // Beacons are identified by their `state_key`,
        // where `state_key` is always owner mxid for access control.
        // Thus, only one beacon is allowed per-user per-room.
        // See https://github.com/matrix-org/matrix-spec-proposals/pull/3672
        // When a user creates a new beacon any previous
        // beacon is replaced and should assume a 'stopped' state
        // Here we check that this event is the latest beacon for this user
        // If it is not the beacon instance is set to undefined.
        // Retired beacons don't get a beacon instance.
        if (beaconInstance?.beaconInfoId === beaconInfoEvent.getId()) {
            setBeacon(beaconInstance);
        } else {
            setBeacon(undefined);
        }
    }, [beaconInfoEvent, matrixClient]);

    // beacon update will fire when this beacon is superseded
    // check the updated event id for equality to the matrix event
    const beaconInstanceEventId = useEventEmitterState(beacon, BeaconEvent.Update, () => beacon?.beaconInfoId);

    useEffect(() => {
        if (beaconInstanceEventId && beaconInstanceEventId !== beaconInfoEvent.getId()) {
            setBeacon(undefined);
        }
    }, [beaconInstanceEventId, beaconInfoEvent]);

    useEffect(() => {
        if (beacon) {
            beacon.monitorLiveness();
        }
    }, [beacon]);

    return beacon;
};

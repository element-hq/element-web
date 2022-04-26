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

import { useEffect, useState } from "react";
import { Beacon, BeaconIdentifier } from "matrix-js-sdk/src/matrix";

import { useEventEmitterState } from "../../hooks/useEventEmitter";
import { OwnBeaconStore, OwnBeaconStoreEvent } from "../../stores/OwnBeaconStore";
import { sortBeaconsByLatestExpiry } from "./duration";

type LiveBeaconsState = {
    beacon?: Beacon;
    onStopSharing?: () => void;
    onResetWireError?: () => void;
    stoppingInProgress?: boolean;
    hasStopSharingError?: boolean;
    hasWireError?: boolean;
};

/**
 * Monitor the current users own beacons
 * While current implementation only allows one live beacon per user per room
 * In future it will be possible to have multiple live beacons in one room
 * Select the latest expiry to display,
 * and kill all beacons on stop sharing
 */
export const useOwnLiveBeacons = (liveBeaconIds: BeaconIdentifier[]): LiveBeaconsState => {
    const [stoppingInProgress, setStoppingInProgress] = useState(false);
    const [error, setError] = useState<Error>();

    const hasWireError = useEventEmitterState(
        OwnBeaconStore.instance,
        OwnBeaconStoreEvent.WireError,
        () =>
            liveBeaconIds.some(OwnBeaconStore.instance.beaconHasWireError),
    );

    // reset stopping in progress on change in live ids
    useEffect(() => {
        setStoppingInProgress(false);
        setError(undefined);
    }, [liveBeaconIds]);

    // select the beacon with latest expiry to display expiry time
    const beacon = liveBeaconIds.map(beaconId => OwnBeaconStore.instance.getBeaconById(beaconId))
        .sort(sortBeaconsByLatestExpiry)
        .shift();

    const onStopSharing = async () => {
        setStoppingInProgress(true);
        try {
            await Promise.all(liveBeaconIds.map(beaconId => OwnBeaconStore.instance.stopBeacon(beaconId)));
        } catch (error) {
            // only clear loading in case of error
            // to avoid flash of not-loading state
            // after beacons have been stopped but we wait for sync
            setError(error);
            setStoppingInProgress(false);
        }
    };

    const onResetWireError = () => {
        liveBeaconIds.map(beaconId => OwnBeaconStore.instance.resetWireError(beaconId));
    };

    return {
        onStopSharing,
        onResetWireError,
        beacon,
        stoppingInProgress,
        hasWireError,
        hasStopSharingError: !!error,
    };
};

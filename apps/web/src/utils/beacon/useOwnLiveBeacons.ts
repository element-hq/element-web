/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useState } from "react";
import { type Beacon, type BeaconIdentifier } from "matrix-js-sdk/src/matrix";

import { useEventEmitterState } from "../../hooks/useEventEmitter";
import { OwnBeaconStore, OwnBeaconStoreEvent } from "../../stores/OwnBeaconStore";
import { sortBeaconsByLatestExpiry } from "./duration";

type LiveBeaconsState = {
    beacon?: Beacon;
    onStopSharing: () => void;
    onResetLocationPublishError: () => void;
    stoppingInProgress: boolean;
    hasStopSharingError: boolean;
    hasLocationPublishError: boolean;
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

    const hasLocationPublishError = useEventEmitterState(
        OwnBeaconStore.instance,
        OwnBeaconStoreEvent.LocationPublishError,
        () => liveBeaconIds.some(OwnBeaconStore.instance.beaconHasLocationPublishError),
    );

    const hasStopSharingError = useEventEmitterState(
        OwnBeaconStore.instance,
        OwnBeaconStoreEvent.BeaconUpdateError,
        () => liveBeaconIds.some((id) => OwnBeaconStore.instance.beaconUpdateErrors.has(id)),
    );

    useEffect(() => {
        if (hasStopSharingError) {
            setStoppingInProgress(false);
        }
    }, [hasStopSharingError]);

    // reset stopping in progress on change in live ids
    useEffect(() => {
        setStoppingInProgress(false);
    }, [liveBeaconIds]);

    // select the beacon with latest expiry to display expiry time
    const beacon = liveBeaconIds
        .map((beaconId) => OwnBeaconStore.instance.getBeaconById(beaconId)!)
        .sort(sortBeaconsByLatestExpiry)
        .shift();

    const onStopSharing = async (): Promise<void> => {
        setStoppingInProgress(true);
        try {
            await Promise.all(liveBeaconIds.map((beaconId) => OwnBeaconStore.instance.stopBeacon(beaconId)));
        } catch {
            setStoppingInProgress(false);
        }
    };

    const onResetLocationPublishError = (): void => {
        liveBeaconIds.forEach((beaconId) => {
            OwnBeaconStore.instance.resetLocationPublishError(beaconId);
        });
    };

    return {
        onStopSharing,
        onResetLocationPublishError,
        beacon,
        stoppingInProgress,
        hasLocationPublishError,
        hasStopSharingError,
    };
};

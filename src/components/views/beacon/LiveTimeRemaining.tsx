/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useState } from "react";
import { BeaconEvent, type Beacon } from "matrix-js-sdk/src/matrix";

import { formatDuration } from "../../../DateUtils";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { useInterval } from "../../../hooks/useTimeout";
import { _t } from "../../../languageHandler";
import { getBeaconMsUntilExpiry } from "../../../utils/beacon";

const MINUTE_MS = 60000;
const HOUR_MS = MINUTE_MS * 60;
const getUpdateInterval = (ms: number): number => {
    // every 10 mins when more than an hour
    if (ms > HOUR_MS) {
        return MINUTE_MS * 10;
    }
    // every minute when more than a minute
    if (ms > MINUTE_MS) {
        return MINUTE_MS;
    }
    // otherwise every second
    return 1000;
};
const useMsRemaining = (beacon: Beacon): number => {
    const beaconInfo = useEventEmitterState(beacon, BeaconEvent.Update, () => beacon.beaconInfo);

    const [msRemaining, setMsRemaining] = useState(() => (beaconInfo ? getBeaconMsUntilExpiry(beaconInfo) : 0));

    useEffect(() => {
        if (!beaconInfo) {
            return;
        }
        setMsRemaining(getBeaconMsUntilExpiry(beaconInfo));
    }, [beaconInfo]);

    const updateMsRemaining = useCallback(() => {
        if (!beaconInfo) {
            return;
        }
        const ms = getBeaconMsUntilExpiry(beaconInfo);
        setMsRemaining(ms);
    }, [beaconInfo]);

    useInterval(updateMsRemaining, getUpdateInterval(msRemaining));

    return msRemaining;
};

const LiveTimeRemaining: React.FC<{ beacon: Beacon }> = ({ beacon }) => {
    const msRemaining = useMsRemaining(beacon);

    const timeRemaining = formatDuration(msRemaining);
    const liveTimeRemaining = _t("time|left", { timeRemaining });

    return (
        <span data-testid="room-live-share-expiry" className="mx_LiveTimeRemaining">
            {liveTimeRemaining}
        </span>
    );
};

export default LiveTimeRemaining;

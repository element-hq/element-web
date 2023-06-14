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

import React, { useCallback, useEffect, useState } from "react";
import { BeaconEvent, Beacon } from "matrix-js-sdk/src/matrix";

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
    const liveTimeRemaining = _t(`%(timeRemaining)s left`, { timeRemaining });

    return (
        <span data-testid="room-live-share-expiry" className="mx_LiveTimeRemaining">
            {liveTimeRemaining}
        </span>
    );
};

export default LiveTimeRemaining;

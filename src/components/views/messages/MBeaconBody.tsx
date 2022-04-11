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

import React from 'react';
import { BeaconEvent, MatrixEvent } from 'matrix-js-sdk/src/matrix';
import { BeaconLocationState } from 'matrix-js-sdk/src/content-helpers';

import { IBodyProps } from "./IBodyProps";
import { useEventEmitterState } from '../../../hooks/useEventEmitter';
import { useBeacon } from '../../../utils/beacon';

const useBeaconState = (beaconInfoEvent: MatrixEvent): {
    hasBeacon: boolean;
    description?: string;
    latestLocationState?: BeaconLocationState;
    isLive?: boolean;
} => {
    const beacon = useBeacon(beaconInfoEvent);

    const isLive = useEventEmitterState(
        beacon,
        BeaconEvent.LivenessChange,
        () => beacon?.isLive);

    const latestLocationState = useEventEmitterState(
        beacon,
        BeaconEvent.LocationUpdate,
        () => beacon?.latestLocationState);

    if (!beacon) {
        return {
            hasBeacon: false,
        };
    }

    const { description } = beacon.beaconInfo;

    return {
        hasBeacon: true,
        description,
        isLive,
        latestLocationState,
    };
};

const MBeaconBody: React.FC<IBodyProps> = React.forwardRef(({ mxEvent, ...rest }, ref) => {
    const {
        hasBeacon,
        isLive,
        description,
        latestLocationState,
    } = useBeaconState(mxEvent);

    if (!hasBeacon || !isLive) {
        // TODO stopped, error states
        return <span ref={ref}>Beacon stopped or replaced</span>;
    }

    return (
        // TODO nice map
        <div className='mx_MBeaconBody' ref={ref}>
            <code>{ mxEvent.getId() }</code>&nbsp;
            <span>Beacon "{ description }" </span>
            { latestLocationState ?
                <span>{ `${latestLocationState.uri} at ${latestLocationState.timestamp}` }</span> :
                <span data-test-id='beacon-waiting-for-location'>Waiting for location</span> }
        </div>
    );
});

export default MBeaconBody;


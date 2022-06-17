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

import { getBeaconInfoIdentifier } from "matrix-js-sdk/src/matrix";

import { ForwardableEventTransformFunction } from "./types";

/**
 * Live location beacons should forward their latest location as a static pin location
 * If the beacon is not live, or doesn't have a location forwarding is not allowed
 */
export const getForwardableBeaconEvent: ForwardableEventTransformFunction = (event, cli) => {
    const room = cli.getRoom(event.getRoomId());
    const beacon = room.currentState.beacons?.get(getBeaconInfoIdentifier(event));
    const latestLocationEvent = beacon.latestLocationEvent;

    if (beacon.isLive && latestLocationEvent) {
        return latestLocationEvent;
    }
    return null;
};

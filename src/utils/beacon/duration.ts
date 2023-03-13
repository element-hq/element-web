/*
Copyright 2022 The Matrix.org Foundation C.I.C

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

import { BeaconInfoState } from "matrix-js-sdk/src/content-helpers";
import { Beacon } from "matrix-js-sdk/src/matrix";

/**
 * Get ms until expiry
 * Returns 0 when expiry is already passed
 * @param startTimestamp
 * @param durationMs
 * @returns remainingMs
 */
export const msUntilExpiry = (startTimestamp: number, durationMs: number): number =>
    Math.max(0, startTimestamp + durationMs - Date.now());

export const getBeaconMsUntilExpiry = (beaconInfo: BeaconInfoState): number =>
    msUntilExpiry(beaconInfo.timestamp || 0, beaconInfo.timeout);

export const getBeaconExpiryTimestamp = (beacon: Beacon): number =>
    (beacon.beaconInfo.timestamp || 0) + beacon.beaconInfo.timeout;

export const sortBeaconsByLatestExpiry = (left: Beacon, right: Beacon): number =>
    getBeaconExpiryTimestamp(right) - getBeaconExpiryTimestamp(left);

// aka sort by timestamp descending
export const sortBeaconsByLatestCreation = (left: Beacon, right: Beacon): number =>
    (right.beaconInfo.timestamp || 0) - (left.beaconInfo.timestamp || 0);

// a beacon's starting timestamp can be in the future
// (either from small deviations in system clock times, or on purpose from another client)
// a beacon is only live between its start timestamp and expiry
// detect when a beacon is waiting to become live
export const isBeaconWaitingToStart = (beacon: Beacon): boolean =>
    !beacon.isLive &&
    !!beacon.beaconInfo.timestamp &&
    beacon.beaconInfo.timestamp > Date.now() &&
    getBeaconExpiryTimestamp(beacon) > Date.now();

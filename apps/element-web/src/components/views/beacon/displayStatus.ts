/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ContentHelpers } from "matrix-js-sdk/src/matrix";

export enum BeaconDisplayStatus {
    Loading = "Loading",
    Error = "Error",
    Stopped = "Stopped",
    Active = "Active",
}
export const getBeaconDisplayStatus = (
    isLive: boolean,
    latestLocationState?: ContentHelpers.BeaconLocationState,
    error?: Error,
    waitingToStart?: boolean,
): BeaconDisplayStatus => {
    if (error) {
        return BeaconDisplayStatus.Error;
    }
    if (waitingToStart) {
        return BeaconDisplayStatus.Loading;
    }
    if (!isLive) {
        return BeaconDisplayStatus.Stopped;
    }
    if (!latestLocationState) {
        return BeaconDisplayStatus.Loading;
    }
    return BeaconDisplayStatus.Active;
};

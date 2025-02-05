/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ExtendedDevice, DeviceSecurityVariation } from "./types";

type DeviceFilterCondition = (device: ExtendedDevice) => boolean;

const MS_DAY = 24 * 60 * 60 * 1000;
export const INACTIVE_DEVICE_AGE_MS = 7.776e9; // 90 days
export const INACTIVE_DEVICE_AGE_DAYS = INACTIVE_DEVICE_AGE_MS / MS_DAY;

export type FilterVariation =
    | DeviceSecurityVariation.Verified
    | DeviceSecurityVariation.Inactive
    | DeviceSecurityVariation.Unverified;

export const isDeviceInactive: DeviceFilterCondition = (device) =>
    !!device.last_seen_ts && device.last_seen_ts < Date.now() - INACTIVE_DEVICE_AGE_MS;

const filters: Record<FilterVariation, DeviceFilterCondition> = {
    [DeviceSecurityVariation.Verified]: (device) => !!device.isVerified,
    [DeviceSecurityVariation.Unverified]: (device) => !device.isVerified,
    [DeviceSecurityVariation.Inactive]: isDeviceInactive,
};

export const filterDevicesBySecurityRecommendation = (
    devices: ExtendedDevice[],
    securityVariations: FilterVariation[],
): ExtendedDevice[] => {
    const activeFilters = securityVariations.map((variation) => filters[variation]);
    if (!activeFilters.length) {
        return devices;
    }
    return devices.filter((device) => activeFilters.every((filter) => filter(device)));
};

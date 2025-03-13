/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { filterDevicesBySecurityRecommendation } from "../../../../../../src/components/views/settings/devices/filter";
import { DeviceSecurityVariation } from "../../../../../../src/components/views/settings/devices/types";
import { DeviceType } from "../../../../../../src/utils/device/parseUserAgent";

const MS_DAY = 86400000;
describe("filterDevicesBySecurityRecommendation()", () => {
    const unverifiedNoMetadata = {
        device_id: "unverified-no-metadata",
        isVerified: false,
        deviceType: DeviceType.Unknown,
    };
    const verifiedNoMetadata = {
        device_id: "verified-no-metadata",
        isVerified: true,
        deviceType: DeviceType.Unknown,
    };
    const hundredDaysOld = {
        device_id: "100-days-old",
        isVerified: true,
        last_seen_ts: Date.now() - MS_DAY * 100,
        deviceType: DeviceType.Unknown,
    };
    const hundredDaysOldUnverified = {
        device_id: "unverified-100-days-old",
        isVerified: false,
        last_seen_ts: Date.now() - MS_DAY * 100,
        deviceType: DeviceType.Unknown,
    };
    const fiftyDaysOld = {
        device_id: "50-days-old",
        isVerified: true,
        last_seen_ts: Date.now() - MS_DAY * 50,
        deviceType: DeviceType.Unknown,
    };

    const devices = [unverifiedNoMetadata, verifiedNoMetadata, hundredDaysOld, hundredDaysOldUnverified, fiftyDaysOld];

    it("returns all devices when no securityRecommendations are passed", () => {
        expect(filterDevicesBySecurityRecommendation(devices, [])).toBe(devices);
    });

    it("returns devices older than 90 days as inactive", () => {
        expect(filterDevicesBySecurityRecommendation(devices, [DeviceSecurityVariation.Inactive])).toEqual([
            // devices without ts metadata are not filtered as inactive
            hundredDaysOld,
            hundredDaysOldUnverified,
        ]);
    });

    it("returns correct devices for verified filter", () => {
        expect(filterDevicesBySecurityRecommendation(devices, [DeviceSecurityVariation.Verified])).toEqual([
            verifiedNoMetadata,
            hundredDaysOld,
            fiftyDaysOld,
        ]);
    });

    it("returns correct devices for unverified filter", () => {
        expect(filterDevicesBySecurityRecommendation(devices, [DeviceSecurityVariation.Unverified])).toEqual([
            unverifiedNoMetadata,
            hundredDaysOldUnverified,
        ]);
    });

    it("returns correct devices for combined verified and inactive filters", () => {
        expect(
            filterDevicesBySecurityRecommendation(devices, [
                DeviceSecurityVariation.Unverified,
                DeviceSecurityVariation.Inactive,
            ]),
        ).toEqual([hundredDaysOldUnverified]);
    });
});

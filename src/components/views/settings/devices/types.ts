/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IMyDevice } from "matrix-js-sdk/src/matrix";

import { type ExtendedDeviceInformation } from "../../../../utils/device/parseUserAgent";

export type DeviceWithVerification = IMyDevice & {
    /**
     * `null` if the device is unknown or has not published encryption keys; otherwise a boolean
     * indicating whether the device has been cross-signed by a cross-signing key we trust.
     */
    isVerified: boolean | null;
};
export type ExtendedDeviceAppInfo = {
    // eg Element Web
    appName?: string;
    appVersion?: string;
    url?: string;
};
export type ExtendedDevice = DeviceWithVerification & ExtendedDeviceAppInfo & ExtendedDeviceInformation;
export type DevicesDictionary = Record<ExtendedDevice["device_id"], ExtendedDevice>;

export enum DeviceSecurityVariation {
    Verified = "Verified",
    Unverified = "Unverified",
    Inactive = "Inactive",
    // sessions that do not support encryption
    // eg a session that logged in via api to get an access token
    Unverifiable = "Unverifiable",
}

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

import { IMyDevice } from "matrix-js-sdk/src/matrix";

import { ExtendedDeviceInformation } from "../../../../utils/device/parseUserAgent";

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

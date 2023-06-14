/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { Device } from "../models/device";
import { DeviceInfo } from "./deviceinfo";

/**
 * Convert a {@link DeviceInfo} to a {@link Device}.
 * @param deviceInfo - deviceInfo to convert
 * @param userId - id of the user that owns the device.
 */
export function deviceInfoToDevice(deviceInfo: DeviceInfo, userId: string): Device {
    const keys = new Map<string, string>(Object.entries(deviceInfo.keys));
    const displayName = deviceInfo.getDisplayName() || undefined;

    const signatures = new Map<string, Map<string, string>>();
    if (deviceInfo.signatures) {
        for (const userId in deviceInfo.signatures) {
            signatures.set(userId, new Map(Object.entries(deviceInfo.signatures[userId])));
        }
    }

    return new Device({
        deviceId: deviceInfo.deviceId,
        userId: userId,
        keys,
        algorithms: deviceInfo.algorithms,
        verified: deviceInfo.verified,
        signatures,
        displayName,
    });
}

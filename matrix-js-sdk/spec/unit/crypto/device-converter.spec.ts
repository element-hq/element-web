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

import { DeviceInfo } from "../../../src/crypto/deviceinfo";
import { DeviceVerification } from "../../../src";
import { deviceInfoToDevice } from "../../../src/crypto/device-converter";

describe("device-converter", () => {
    const userId = "@alice:example.com";
    const deviceId = "xcvf";

    // All parameters for DeviceInfo initialization
    const keys = {
        [`ed25519:${deviceId}`]: "key1",
        [`curve25519:${deviceId}`]: "key2",
    };
    const algorithms = ["algo1", "algo2"];
    const verified = DeviceVerification.Verified;
    const signatures = { [userId]: { [deviceId]: "sign1" } };
    const displayName = "display name";
    const unsigned = {
        device_display_name: displayName,
    };

    describe("deviceInfoToDevice", () => {
        it("should convert a DeviceInfo to a Device", () => {
            const deviceInfo = DeviceInfo.fromStorage({ keys, algorithms, verified, signatures, unsigned }, deviceId);
            const device = deviceInfoToDevice(deviceInfo, userId);

            expect(device.deviceId).toBe(deviceId);
            expect(device.userId).toBe(userId);
            expect(device.verified).toBe(verified);
            expect(device.getIdentityKey()).toBe(keys[`curve25519:${deviceId}`]);
            expect(device.getFingerprint()).toBe(keys[`ed25519:${deviceId}`]);
            expect(device.displayName).toBe(displayName);
        });

        it("should add empty signatures", () => {
            const deviceInfo = DeviceInfo.fromStorage({ keys, algorithms, verified }, deviceId);
            const device = deviceInfoToDevice(deviceInfo, userId);

            expect(device.signatures.size).toBe(0);
        });
    });
});

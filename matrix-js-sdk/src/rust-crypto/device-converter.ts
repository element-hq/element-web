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

import * as RustSdkCryptoJs from "@matrix-org/matrix-sdk-crypto-js";

import { Device, DeviceVerification } from "../models/device";
import { DeviceKeys } from "../client";

/**
 * Convert a {@link RustSdkCryptoJs.Device} to a {@link Device}
 * @param device - Rust Sdk device
 * @param userId - owner of the device
 */
export function rustDeviceToJsDevice(device: RustSdkCryptoJs.Device, userId: RustSdkCryptoJs.UserId): Device {
    // Copy rust device keys to Device.keys
    const keys = new Map<string, string>();
    for (const [keyId, key] of device.keys.entries()) {
        keys.set(keyId.toString(), key.toBase64());
    }

    // Compute verified from device state
    let verified: DeviceVerification = DeviceVerification.Unverified;
    if (device.isBlacklisted()) {
        verified = DeviceVerification.Blocked;
    } else if (device.isVerified()) {
        verified = DeviceVerification.Verified;
    }

    // Convert rust signatures to Device.signatures
    const signatures = new Map<string, Map<string, string>>();
    const mayBeSignatureMap: Map<string, RustSdkCryptoJs.MaybeSignature> | undefined = device.signatures.get(userId);
    if (mayBeSignatureMap) {
        const convertedSignatures = new Map<string, string>();
        // Convert maybeSignatures map to a Map<string, string>
        for (const [key, value] of mayBeSignatureMap.entries()) {
            if (value.isValid() && value.signature) {
                convertedSignatures.set(key, value.signature.toBase64());
            }
        }

        signatures.set(userId.toString(), convertedSignatures);
    }

    // Convert rust algorithms to algorithms
    const rustAlgorithms: RustSdkCryptoJs.EncryptionAlgorithm[] = device.algorithms;
    // Use set to ensure that algorithms are not duplicated
    const algorithms = new Set<string>();
    rustAlgorithms.forEach((algorithm) => {
        switch (algorithm) {
            case RustSdkCryptoJs.EncryptionAlgorithm.MegolmV1AesSha2:
                algorithms.add("m.megolm.v1.aes-sha2");
                break;
            case RustSdkCryptoJs.EncryptionAlgorithm.OlmV1Curve25519AesSha2:
            default:
                algorithms.add("m.olm.v1.curve25519-aes-sha2");
                break;
        }
    });

    return new Device({
        deviceId: device.deviceId.toString(),
        userId: userId.toString(),
        keys,
        algorithms: Array.from(algorithms),
        verified,
        signatures,
        displayName: device.displayName,
    });
}

/**
 * Convert {@link DeviceKeys}  from `/keys/query` request to a `Map<string, Device>`
 * @param deviceKeys - Device keys object to convert
 */
export function deviceKeysToDeviceMap(deviceKeys: DeviceKeys): Map<string, Device> {
    return new Map(
        Object.entries(deviceKeys).map(([deviceId, device]) => [deviceId, downloadDeviceToJsDevice(device)]),
    );
}

// Device from `/keys/query` request
type QueryDevice = DeviceKeys[keyof DeviceKeys];

/**
 * Convert `/keys/query` {@link QueryDevice} device to {@link Device}
 * @param device - Device from `/keys/query` request
 */
export function downloadDeviceToJsDevice(device: QueryDevice): Device {
    const keys = new Map(Object.entries(device.keys));
    const displayName = device.unsigned?.device_display_name;

    const signatures = new Map<string, Map<string, string>>();
    if (device.signatures) {
        for (const userId in device.signatures) {
            signatures.set(userId, new Map(Object.entries(device.signatures[userId])));
        }
    }

    return new Device({
        deviceId: device.device_id,
        userId: device.user_id,
        keys,
        algorithms: device.algorithms,
        verified: DeviceVerification.Unverified,
        signatures,
        displayName,
    });
}

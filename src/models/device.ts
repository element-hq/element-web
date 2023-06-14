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

/** State of the verification of the device. */
export enum DeviceVerification {
    Blocked = -1,
    Unverified = 0,
    Verified = 1,
}

/** A map from user ID to device ID to Device */
export type DeviceMap = Map<string, Map<string, Device>>;

type DeviceParameters = Pick<Device, "deviceId" | "userId" | "algorithms" | "keys"> & Partial<Device>;

/**
 *  Information on a user's device, as returned by {@link Crypto.CryptoApi.getUserDeviceInfo}.
 */
export class Device {
    /** id of the device */
    public readonly deviceId: string;

    /** id of the user that owns the device */
    public readonly userId: string;

    /** list of algorithms supported by this device */
    public readonly algorithms: string[];

    /** a map from `<key type>:<id> -> <base64-encoded key>` */
    public readonly keys: Map<string, string>;

    /** whether the device has been verified/blocked by the user */
    public readonly verified: DeviceVerification;

    /** a map `<userId, map<algorithm:device_id, signature>>` */
    public readonly signatures: Map<string, Map<string, string>>;

    /** display name of the device */
    public readonly displayName?: string;

    public constructor(opts: DeviceParameters) {
        this.deviceId = opts.deviceId;
        this.userId = opts.userId;
        this.algorithms = opts.algorithms;
        this.keys = opts.keys;
        this.verified = opts.verified || DeviceVerification.Unverified;
        this.signatures = opts.signatures || new Map();
        this.displayName = opts.displayName;
    }

    /**
     * Get the fingerprint for this device (ie, the Ed25519 key)
     *
     * @returns base64-encoded fingerprint of this device
     */
    public getFingerprint(): string | undefined {
        return this.keys.get(`ed25519:${this.deviceId}`);
    }

    /**
     * Get the identity key for this device (ie, the Curve25519 key)
     *
     * @returns base64-encoded identity key of this device
     */
    public getIdentityKey(): string | undefined {
        return this.keys.get(`curve25519:${this.deviceId}`);
    }
}

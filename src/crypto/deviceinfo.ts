/*
Copyright 2016 - 2021 The Matrix.org Foundation C.I.C.

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

import { ISignatures } from "../@types/signed";
import { DeviceVerification } from "../models/device";

export interface IDevice {
    keys: Record<string, string>;
    algorithms: string[];
    verified: DeviceVerification;
    known: boolean;
    unsigned?: Record<string, any>;
    signatures?: ISignatures;
}

/**
 * Information about a user's device
 */
export class DeviceInfo {
    /**
     * rehydrate a DeviceInfo from the session store
     *
     * @param obj -  raw object from session store
     * @param deviceId - id of the device
     *
     * @returns new DeviceInfo
     */
    public static fromStorage(obj: Partial<IDevice>, deviceId: string): DeviceInfo {
        const res = new DeviceInfo(deviceId);
        for (const prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                // @ts-ignore - this is messy and typescript doesn't like it
                res[prop as keyof IDevice] = obj[prop as keyof IDevice];
            }
        }
        return res;
    }

    public static DeviceVerification = {
        VERIFIED: DeviceVerification.Verified,
        UNVERIFIED: DeviceVerification.Unverified,
        BLOCKED: DeviceVerification.Blocked,
    };

    /** list of algorithms supported by this device */
    public algorithms: string[] = [];
    /** a map from `<key type>:<id> -> <base64-encoded key>` */
    public keys: Record<string, string> = {};
    /** whether the device has been verified/blocked by the user */
    public verified = DeviceVerification.Unverified;
    /**
     * whether the user knows of this device's existence
     * (useful when warning the user that a user has added new devices)
     */
    public known = false;
    /** additional data from the homeserver */
    public unsigned: Record<string, any> = {};
    public signatures: ISignatures = {};

    /**
     * @param deviceId - id of the device
     */
    public constructor(public readonly deviceId: string) {}

    /**
     * Prepare a DeviceInfo for JSON serialisation in the session store
     *
     * @returns deviceinfo with non-serialised members removed
     */
    public toStorage(): IDevice {
        return {
            algorithms: this.algorithms,
            keys: this.keys,
            verified: this.verified,
            known: this.known,
            unsigned: this.unsigned,
            signatures: this.signatures,
        };
    }

    /**
     * Get the fingerprint for this device (ie, the Ed25519 key)
     *
     * @returns base64-encoded fingerprint of this device
     */
    public getFingerprint(): string {
        return this.keys["ed25519:" + this.deviceId];
    }

    /**
     * Get the identity key for this device (ie, the Curve25519 key)
     *
     * @returns base64-encoded identity key of this device
     */
    public getIdentityKey(): string {
        return this.keys["curve25519:" + this.deviceId];
    }

    /**
     * Get the configured display name for this device, if any
     *
     * @returns displayname
     */
    public getDisplayName(): string | null {
        return this.unsigned.device_display_name || null;
    }

    /**
     * Returns true if this device is blocked
     *
     * @returns true if blocked
     */
    public isBlocked(): boolean {
        return this.verified == DeviceVerification.Blocked;
    }

    /**
     * Returns true if this device is verified
     *
     * @returns true if verified
     */
    public isVerified(): boolean {
        return this.verified == DeviceVerification.Verified;
    }

    /**
     * Returns true if this device is unverified
     *
     * @returns true if unverified
     */
    public isUnverified(): boolean {
        return this.verified == DeviceVerification.Unverified;
    }

    /**
     * Returns true if the user knows about this device's existence
     *
     * @returns true if known
     */
    public isKnown(): boolean {
        return this.known === true;
    }
}

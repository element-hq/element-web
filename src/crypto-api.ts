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

import type { IMegolmSessionData } from "./@types/crypto";
import { Room } from "./models/room";
import { DeviceMap } from "./models/device";
import { UIAuthCallback } from "./interactive-auth";
import { AddSecretStorageKeyOpts } from "./secret-storage";

/** Types of cross-signing key */
export enum CrossSigningKey {
    Master = "master",
    SelfSigning = "self_signing",
    UserSigning = "user_signing",
}

/**
 * Recovery key created by {@link CryptoApi#createRecoveryKeyFromPassphrase}
 */
export interface GeneratedSecretStorageKey {
    keyInfo?: AddSecretStorageKeyOpts;
    /** The raw generated private key. */
    privateKey: Uint8Array;
    /** The generated key, encoded for display to the user per https://spec.matrix.org/v1.7/client-server-api/#key-representation. */
    encodedPrivateKey?: string;
}

/**
 * Public interface to the cryptography parts of the js-sdk
 *
 * @remarks Currently, this is a work-in-progress. In time, more methods will be added here.
 */
export interface CryptoApi {
    /**
     * Global override for whether the client should ever send encrypted
     * messages to unverified devices. This provides the default for rooms which
     * do not specify a value.
     *
     * If true, all unverified devices will be blacklisted by default
     */
    globalBlacklistUnverifiedDevices: boolean;

    /**
     * Checks if the user has previously published cross-signing keys
     *
     * This means downloading the devicelist for the user and checking if the list includes
     * the cross-signing pseudo-device.
     *
     * @returns true if the user has previously published cross-signing keys
     */
    userHasCrossSigningKeys(): Promise<boolean>;

    /**
     * Perform any background tasks that can be done before a message is ready to
     * send, in order to speed up sending of the message.
     *
     * @param room - the room the event is in
     */
    prepareToEncrypt(room: Room): void;

    /**
     * Discard any existing megolm session for the given room.
     *
     * This will ensure that a new session is created on the next call to {@link prepareToEncrypt},
     * or the next time a message is sent.
     *
     * This should not normally be necessary: it should only be used as a debugging tool if there has been a
     * problem with encryption.
     *
     * @param roomId - the room to discard sessions for
     */
    forceDiscardSession(roomId: string): Promise<void>;

    /**
     * Get a list containing all of the room keys
     *
     * This should be encrypted before returning it to the user.
     *
     * @returns a promise which resolves to a list of
     *    session export objects
     */
    exportRoomKeys(): Promise<IMegolmSessionData[]>;

    /**
     * Import a list of room keys previously exported by exportRoomKeys
     *
     * @param keys - a list of session export objects
     * @param opts - options object
     * @returns a promise which resolves once the keys have been imported
     */
    importRoomKeys(keys: IMegolmSessionData[], opts?: ImportRoomKeysOpts): Promise<void>;

    /**
     * Get the device information for the given list of users.
     *
     * For any users whose device lists are cached (due to sharing an encrypted room with the user), the
     * cached device data is returned.
     *
     * If there are uncached users, and the `downloadUncached` parameter is set to `true`,
     * a `/keys/query` request is made to the server to retrieve these devices.
     *
     * @param userIds - The users to fetch.
     * @param downloadUncached - If true, download the device list for users whose device list we are not
     *    currently tracking. Defaults to false, in which case such users will not appear at all in the result map.
     *
     * @returns A map `{@link DeviceMap}`.
     */
    getUserDeviceInfo(userIds: string[], downloadUncached?: boolean): Promise<DeviceMap>;

    /**
     * Set whether to trust other user's signatures of their devices.
     *
     * If false, devices will only be considered 'verified' if we have
     * verified that device individually (effectively disabling cross-signing).
     *
     * `true` by default.
     *
     * @param val - the new value
     */
    setTrustCrossSignedDevices(val: boolean): void;

    /**
     * Return whether we trust other user's signatures of their devices.
     *
     * @see {@link Crypto.CryptoApi#setTrustCrossSignedDevices}
     *
     * @returns `true` if we trust cross-signed devices, otherwise `false`.
     */
    getTrustCrossSignedDevices(): boolean;

    /**
     * Get the verification status of a given device.
     *
     * @param userId - The ID of the user whose device is to be checked.
     * @param deviceId - The ID of the device to check
     *
     * @returns `null` if the device is unknown, or has not published any encryption keys (implying it does not support
     *     encryption); otherwise the verification status of the device.
     */
    getDeviceVerificationStatus(userId: string, deviceId: string): Promise<DeviceVerificationStatus | null>;

    /**
     * Checks whether cross signing:
     * - is enabled on this account and trusted by this device
     * - has private keys either cached locally or stored in secret storage
     *
     * If this function returns false, bootstrapCrossSigning() can be used
     * to fix things such that it returns true. That is to say, after
     * bootstrapCrossSigning() completes successfully, this function should
     * return true.
     *
     * @returns True if cross-signing is ready to be used on this device
     */
    isCrossSigningReady(): Promise<boolean>;

    /**
     * Get the ID of one of the user's cross-signing keys.
     *
     * @param type - The type of key to get the ID of.  One of `CrossSigningKey.Master`, `CrossSigningKey.SelfSigning`,
     *     or `CrossSigningKey.UserSigning`.  Defaults to `CrossSigningKey.Master`.
     *
     * @returns If cross-signing has been initialised on this device, the ID of the given key. Otherwise, null
     */
    getCrossSigningKeyId(type?: CrossSigningKey): Promise<string | null>;

    /**
     * Bootstrap cross-signing by creating keys if needed.
     *
     * If everything is already set up, then no changes are made, so this is safe to run to ensure
     * cross-signing is ready for use.
     *
     * This function:
     * - creates new cross-signing keys if they are not found locally cached nor in
     *   secret storage (if it has been set up)
     * - publishes the public keys to the server if they are not already published
     * - stores the private keys in secret storage if secret storage is set up.
     *
     * @param opts - options object
     */
    bootstrapCrossSigning(opts: BootstrapCrossSigningOpts): Promise<void>;

    /**
     * Checks whether secret storage:
     * - is enabled on this account
     * - is storing cross-signing private keys
     * - is storing session backup key (if enabled)
     *
     * If this function returns false, bootstrapSecretStorage() can be used
     * to fix things such that it returns true. That is to say, after
     * bootstrapSecretStorage() completes successfully, this function should
     * return true.
     *
     * @returns True if secret storage is ready to be used on this device
     */
    isSecretStorageReady(): Promise<boolean>;

    /**
     * Get the status of our cross-signing keys.
     *
     * @returns The current status of cross-signing keys: whether we have public and private keys cached locally, and whether the private keys are in secret storage.
     */
    getCrossSigningStatus(): Promise<CrossSigningStatus>;

    /**
     * Create a recovery key (ie, a key suitable for use with server-side secret storage).
     *
     * The key can either be based on a user-supplied passphrase, or just created randomly.
     *
     * @param password - Optional passphrase string to use to derive the key,
     *      which can later be entered by the user as an alternative to entering the
     *      recovery key itself. If omitted, a key is generated randomly.
     *
     * @returns Object including recovery key and server upload parameters.
     *      The private key should be disposed of after displaying to the use.
     */
    createRecoveryKeyFromPassphrase(password?: string): Promise<GeneratedSecretStorageKey>;
}

/**
 * Options object for `CryptoApi.bootstrapCrossSigning`.
 */
export interface BootstrapCrossSigningOpts {
    /** Optional. Reset the cross-signing keys even if keys already exist. */
    setupNewCrossSigning?: boolean;

    /**
     * An application callback to collect the authentication data for uploading the keys. If not given, the keys
     * will not be uploaded to the server (which seems like a bad thing?).
     */
    authUploadDeviceSigningKeys?: UIAuthCallback<void>;
}

export class DeviceVerificationStatus {
    /**
     * True if this device has been signed by its owner (and that signature verified).
     *
     * This doesn't necessarily mean that we have verified the device, since we may not have verified the
     * owner's cross-signing key.
     */
    public readonly signedByOwner: boolean;

    /**
     * True if this device has been verified via cross signing.
     *
     * This does *not* take into account `trustCrossSignedDevices`.
     */
    public readonly crossSigningVerified: boolean;

    /**
     * TODO: tofu magic wtf does this do?
     */
    public readonly tofu: boolean;

    /**
     * True if the device has been marked as locally verified.
     */
    public readonly localVerified: boolean;

    /**
     * True if the client has been configured to trust cross-signed devices via {@link CryptoApi#setTrustCrossSignedDevices}.
     */
    private readonly trustCrossSignedDevices: boolean;

    public constructor(
        opts: Partial<DeviceVerificationStatus> & {
            /**
             * True if cross-signed devices should be considered verified for {@link DeviceVerificationStatus#isVerified}.
             */
            trustCrossSignedDevices?: boolean;
        },
    ) {
        this.signedByOwner = opts.signedByOwner ?? false;
        this.crossSigningVerified = opts.crossSigningVerified ?? false;
        this.tofu = opts.tofu ?? false;
        this.localVerified = opts.localVerified ?? false;
        this.trustCrossSignedDevices = opts.trustCrossSignedDevices ?? false;
    }

    /**
     * Check if we should consider this device "verified".
     *
     * A device is "verified" if either:
     *  * it has been manually marked as such via {@link MatrixClient#setDeviceVerified}.
     *  * it has been cross-signed with a verified signing key, **and** the client has been configured to trust
     *    cross-signed devices via {@link Crypto.CryptoApi#setTrustCrossSignedDevices}.
     *
     * @returns true if this device is verified via any means.
     */
    public isVerified(): boolean {
        return this.localVerified || (this.trustCrossSignedDevices && this.crossSigningVerified);
    }
}

/**
 * Room key import progress report.
 * Used when calling {@link CryptoApi#importRoomKeys} as the parameter of
 * the progressCallback. Used to display feedback.
 */
export interface ImportRoomKeyProgressData {
    stage: string; // TODO: Enum
    successes: number;
    failures: number;
    total: number;
}

/**
 * Options object for {@link CryptoApi#importRoomKeys}.
 */
export interface ImportRoomKeysOpts {
    /** Reports ongoing progress of the import process. Can be used for feedback. */
    progressCallback?: (stage: ImportRoomKeyProgressData) => void;
    // TODO, the rust SDK will always such imported keys as untrusted
    untrusted?: boolean;
    source?: String; // TODO: Enum (backup, file, ??)
}

export * from "./crypto-api/verification";

/**
 * The result of a call to {@link CryptoApi.getCrossSigningStatus}.
 */
export interface CrossSigningStatus {
    /**
     * True if the public master, self signing and user signing keys are available on this device.
     */
    publicKeysOnDevice: boolean;
    /**
     * True if the private keys are stored in the secret storage.
     */
    privateKeysInSecretStorage: boolean;
    /**
     * True if the private keys are stored locally.
     */
    privateKeysCachedLocally: {
        masterKey: boolean;
        selfSigningKey: boolean;
        userSigningKey: boolean;
    };
}

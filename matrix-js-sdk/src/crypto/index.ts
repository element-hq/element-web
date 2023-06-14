/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018-2019 New Vector Ltd
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

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

import anotherjson from "another-json";
import { v4 as uuidv4 } from "uuid";

import type { IDeviceKeys, IEventDecryptionResult, IMegolmSessionData, IOneTimeKey } from "../@types/crypto";
import type { PkDecryption, PkSigning } from "@matrix-org/olm";
import { EventType, ToDeviceMessageId } from "../@types/event";
import { TypedReEmitter } from "../ReEmitter";
import { logger } from "../logger";
import { IExportedDevice, OlmDevice } from "./OlmDevice";
import { IOlmDevice } from "./algorithms/megolm";
import * as olmlib from "./olmlib";
import { DeviceInfoMap, DeviceList } from "./DeviceList";
import { DeviceInfo, IDevice } from "./deviceinfo";
import type { DecryptionAlgorithm, EncryptionAlgorithm } from "./algorithms";
import * as algorithms from "./algorithms";
import { createCryptoStoreCacheCallbacks, CrossSigningInfo, DeviceTrustLevel, UserTrustLevel } from "./CrossSigning";
import { EncryptionSetupBuilder } from "./EncryptionSetup";
import { SecretStorage as LegacySecretStorage } from "./SecretStorage";
import { CrossSigningKey, ICreateSecretStorageOpts, IEncryptedEventInfo, IRecoveryKey } from "./api";
import { OutgoingRoomKeyRequestManager } from "./OutgoingRoomKeyRequestManager";
import { IndexedDBCryptoStore } from "./store/indexeddb-crypto-store";
import { VerificationBase } from "./verification/Base";
import { ReciprocateQRCode, SCAN_QR_CODE_METHOD, SHOW_QR_CODE_METHOD } from "./verification/QRCode";
import { SAS as SASVerification } from "./verification/SAS";
import { keyFromPassphrase } from "./key_passphrase";
import { decodeRecoveryKey, encodeRecoveryKey } from "./recoverykey";
import { VerificationRequest } from "./verification/request/VerificationRequest";
import { InRoomChannel, InRoomRequests } from "./verification/request/InRoomChannel";
import { Request, ToDeviceChannel, ToDeviceRequests } from "./verification/request/ToDeviceChannel";
import { IllegalMethod } from "./verification/IllegalMethod";
import { KeySignatureUploadError } from "../errors";
import { calculateKeyCheck, decryptAES, encryptAES } from "./aes";
import { DehydrationManager } from "./dehydration";
import { BackupManager } from "./backup";
import { IStore } from "../store";
import { Room, RoomEvent } from "../models/room";
import { RoomMember, RoomMemberEvent } from "../models/room-member";
import { EventStatus, IContent, IEvent, MatrixEvent, MatrixEventEvent } from "../models/event";
import { ToDeviceBatch } from "../models/ToDeviceMessage";
import {
    ClientEvent,
    ICrossSigningKey,
    IKeysUploadResponse,
    ISignedKey,
    IUploadKeySignaturesResponse,
    MatrixClient,
} from "../client";
import type { IRoomEncryption, RoomList } from "./RoomList";
import { IKeyBackupInfo } from "./keybackup";
import { ISyncStateData } from "../sync";
import { CryptoStore } from "./store/base";
import { IVerificationChannel } from "./verification/request/Channel";
import { TypedEventEmitter } from "../models/typed-event-emitter";
import { IDeviceLists, ISyncResponse, IToDeviceEvent } from "../sync-accumulator";
import { ISignatures } from "../@types/signed";
import { IMessage } from "./algorithms/olm";
import { CryptoBackend, OnSyncCompletedData } from "../common-crypto/CryptoBackend";
import { RoomState, RoomStateEvent } from "../models/room-state";
import { MapWithDefault, recursiveMapToObject } from "../utils";
import {
    AccountDataClient,
    AddSecretStorageKeyOpts,
    SECRET_STORAGE_ALGORITHM_V1_AES,
    SecretStorageCallbacks,
    SecretStorageKeyDescription,
    SecretStorageKeyObject,
    SecretStorageKeyTuple,
    ServerSideSecretStorageImpl,
} from "../secret-storage";
import { ISecretRequest } from "./SecretSharing";
import {
    BootstrapCrossSigningOpts,
    CrossSigningStatus,
    DeviceVerificationStatus,
    ImportRoomKeysOpts,
} from "../crypto-api";
import { Device, DeviceMap } from "../models/device";
import { deviceInfoToDevice } from "./device-converter";

/* re-exports for backwards compatibility */
export type { BootstrapCrossSigningOpts as IBootstrapCrossSigningOpts } from "../crypto-api";

const DeviceVerification = DeviceInfo.DeviceVerification;

const defaultVerificationMethods = {
    [ReciprocateQRCode.NAME]: ReciprocateQRCode,
    [SASVerification.NAME]: SASVerification,

    // These two can't be used for actual verification, but we do
    // need to be able to define them here for the verification flows
    // to start.
    [SHOW_QR_CODE_METHOD]: IllegalMethod,
    [SCAN_QR_CODE_METHOD]: IllegalMethod,
} as const;

/**
 * verification method names
 */
// legacy export identifier
export const verificationMethods = {
    RECIPROCATE_QR_CODE: ReciprocateQRCode.NAME,
    SAS: SASVerification.NAME,
} as const;

export type VerificationMethod = keyof typeof verificationMethods | string;

export function isCryptoAvailable(): boolean {
    return Boolean(global.Olm);
}

const MIN_FORCE_SESSION_INTERVAL_MS = 60 * 60 * 1000;

interface IInitOpts {
    exportedOlmDevice?: IExportedDevice;
    pickleKey?: string;
}

export interface ICryptoCallbacks extends SecretStorageCallbacks {
    getCrossSigningKey?: (keyType: string, pubKey: string) => Promise<Uint8Array | null>;
    saveCrossSigningKeys?: (keys: Record<string, Uint8Array>) => void;
    shouldUpgradeDeviceVerifications?: (users: Record<string, any>) => Promise<string[]>;
    cacheSecretStorageKey?: (keyId: string, keyInfo: SecretStorageKeyDescription, key: Uint8Array) => void;
    onSecretRequested?: (
        userId: string,
        deviceId: string,
        requestId: string,
        secretName: string,
        deviceTrust: DeviceTrustLevel,
    ) => Promise<string | undefined>;
    getDehydrationKey?: (
        keyInfo: SecretStorageKeyDescription,
        checkFunc: (key: Uint8Array) => void,
    ) => Promise<Uint8Array>;
    getBackupKey?: () => Promise<Uint8Array>;
}

/* eslint-disable camelcase */
interface IRoomKey {
    room_id: string;
    algorithm: string;
}

/**
 * The parameters of a room key request. The details of the request may
 * vary with the crypto algorithm, but the management and storage layers for
 * outgoing requests expect it to have 'room_id' and 'session_id' properties.
 */
export interface IRoomKeyRequestBody extends IRoomKey {
    session_id: string;
    sender_key: string;
}

/* eslint-enable camelcase */

interface IDeviceVerificationUpgrade {
    devices: DeviceInfo[];
    crossSigningInfo: CrossSigningInfo;
}

export interface ICheckOwnCrossSigningTrustOpts {
    allowPrivateKeyRequests?: boolean;
}

interface IUserOlmSession {
    deviceIdKey: string;
    sessions: {
        sessionId: string;
        hasReceivedMessage: boolean;
    }[];
}

export interface IRoomKeyRequestRecipient {
    userId: string;
    deviceId: string;
}

interface ISignableObject {
    signatures?: ISignatures;
    unsigned?: object;
}

export interface IRequestsMap {
    getRequest(event: MatrixEvent): VerificationRequest | undefined;
    getRequestByChannel(channel: IVerificationChannel): VerificationRequest | undefined;
    setRequest(event: MatrixEvent, request: VerificationRequest): void;
    setRequestByChannel(channel: IVerificationChannel, request: VerificationRequest): void;
}

/* eslint-disable camelcase */
export interface IOlmEncryptedContent {
    algorithm: typeof olmlib.OLM_ALGORITHM;
    sender_key: string;
    ciphertext: Record<string, IMessage>;
    [ToDeviceMessageId]?: string;
}

export interface IMegolmEncryptedContent {
    algorithm: typeof olmlib.MEGOLM_ALGORITHM;
    sender_key: string;
    session_id: string;
    device_id: string;
    ciphertext: string;
    [ToDeviceMessageId]?: string;
}
/* eslint-enable camelcase */

export type IEncryptedContent = IOlmEncryptedContent | IMegolmEncryptedContent;

export enum CryptoEvent {
    DeviceVerificationChanged = "deviceVerificationChanged",
    UserTrustStatusChanged = "userTrustStatusChanged",
    UserCrossSigningUpdated = "userCrossSigningUpdated",
    RoomKeyRequest = "crypto.roomKeyRequest",
    RoomKeyRequestCancellation = "crypto.roomKeyRequestCancellation",
    KeyBackupStatus = "crypto.keyBackupStatus",
    KeyBackupFailed = "crypto.keyBackupFailed",
    KeyBackupSessionsRemaining = "crypto.keyBackupSessionsRemaining",
    KeySignatureUploadFailure = "crypto.keySignatureUploadFailure",
    VerificationRequest = "crypto.verification.request",
    Warning = "crypto.warning",
    WillUpdateDevices = "crypto.willUpdateDevices",
    DevicesUpdated = "crypto.devicesUpdated",
    KeysChanged = "crossSigning.keysChanged",
}

export type CryptoEventHandlerMap = {
    /**
     * Fires when a device is marked as verified/unverified/blocked/unblocked by
     * {@link MatrixClient#setDeviceVerified | MatrixClient.setDeviceVerified} or
     * {@link MatrixClient#setDeviceBlocked | MatrixClient.setDeviceBlocked}.
     *
     * @param userId - the owner of the verified device
     * @param deviceId - the id of the verified device
     * @param deviceInfo - updated device information
     */
    [CryptoEvent.DeviceVerificationChanged]: (userId: string, deviceId: string, device: DeviceInfo) => void;
    /**
     * Fires when the trust status of a user changes
     * If userId is the userId of the logged-in user, this indicated a change
     * in the trust status of the cross-signing data on the account.
     *
     * The cross-signing API is currently UNSTABLE and may change without notice.
     * @experimental
     *
     * @param userId - the userId of the user in question
     * @param trustLevel - The new trust level of the user
     */
    [CryptoEvent.UserTrustStatusChanged]: (userId: string, trustLevel: UserTrustLevel) => void;
    /**
     * Fires when we receive a room key request
     *
     * @param req - request details
     */
    [CryptoEvent.RoomKeyRequest]: (request: IncomingRoomKeyRequest) => void;
    /**
     * Fires when we receive a room key request cancellation
     */
    [CryptoEvent.RoomKeyRequestCancellation]: (request: IncomingRoomKeyRequestCancellation) => void;
    /**
     * Fires whenever the status of e2e key backup changes, as returned by getKeyBackupEnabled()
     * @param enabled - true if key backup has been enabled, otherwise false
     * @example
     * ```
     * matrixClient.on("crypto.keyBackupStatus", function(enabled){
     *   if (enabled) {
     *     [...]
     *   }
     * });
     * ```
     */
    [CryptoEvent.KeyBackupStatus]: (enabled: boolean) => void;
    [CryptoEvent.KeyBackupFailed]: (errcode: string) => void;
    [CryptoEvent.KeyBackupSessionsRemaining]: (remaining: number) => void;
    [CryptoEvent.KeySignatureUploadFailure]: (
        failures: IUploadKeySignaturesResponse["failures"],
        source: "checkOwnCrossSigningTrust" | "afterCrossSigningLocalKeyChange" | "setDeviceVerification",
        upload: (opts: { shouldEmit: boolean }) => Promise<void>,
    ) => void;
    /**
     * Fires when a key verification is requested.
     */
    [CryptoEvent.VerificationRequest]: (request: VerificationRequest<any>) => void;
    /**
     * Fires when the app may wish to warn the user about something related
     * the end-to-end crypto.
     *
     * @param type - One of the strings listed above
     */
    [CryptoEvent.Warning]: (type: string) => void;
    /**
     * Fires when the user's cross-signing keys have changed or cross-signing
     * has been enabled/disabled. The client can use getStoredCrossSigningForUser
     * with the user ID of the logged in user to check if cross-signing is
     * enabled on the account. If enabled, it can test whether the current key
     * is trusted using with checkUserTrust with the user ID of the logged
     * in user. The checkOwnCrossSigningTrust function may be used to reconcile
     * the trust in the account key.
     *
     * The cross-signing API is currently UNSTABLE and may change without notice.
     * @experimental
     */
    [CryptoEvent.KeysChanged]: (data: {}) => void;
    /**
     * Fires whenever the stored devices for a user will be updated
     * @param users - A list of user IDs that will be updated
     * @param initialFetch - If true, the store is empty (apart
     *     from our own device) and is being seeded.
     */
    [CryptoEvent.WillUpdateDevices]: (users: string[], initialFetch: boolean) => void;
    /**
     * Fires whenever the stored devices for a user have changed
     * @param users - A list of user IDs that were updated
     * @param initialFetch - If true, the store was empty (apart
     *     from our own device) and has been seeded.
     */
    [CryptoEvent.DevicesUpdated]: (users: string[], initialFetch: boolean) => void;
    [CryptoEvent.UserCrossSigningUpdated]: (userId: string) => void;
};

export class Crypto extends TypedEventEmitter<CryptoEvent, CryptoEventHandlerMap> implements CryptoBackend {
    /**
     * @returns The version of Olm.
     */
    public static getOlmVersion(): [number, number, number] {
        return OlmDevice.getOlmVersion();
    }

    public readonly backupManager: BackupManager;
    public readonly crossSigningInfo: CrossSigningInfo;
    public readonly olmDevice: OlmDevice;
    public readonly deviceList: DeviceList;
    public readonly dehydrationManager: DehydrationManager;
    public readonly secretStorage: LegacySecretStorage;

    private readonly reEmitter: TypedReEmitter<CryptoEvent, CryptoEventHandlerMap>;
    private readonly verificationMethods: Map<VerificationMethod, typeof VerificationBase>;
    public readonly supportedAlgorithms: string[];
    private readonly outgoingRoomKeyRequestManager: OutgoingRoomKeyRequestManager;
    private readonly toDeviceVerificationRequests: ToDeviceRequests;
    public readonly inRoomVerificationRequests: InRoomRequests;

    private trustCrossSignedDevices = true;
    // the last time we did a check for the number of one-time-keys on the server.
    private lastOneTimeKeyCheck: number | null = null;
    private oneTimeKeyCheckInProgress = false;

    // EncryptionAlgorithm instance for each room
    private roomEncryptors = new Map<string, EncryptionAlgorithm>();
    // map from algorithm to DecryptionAlgorithm instance, for each room
    private roomDecryptors = new Map<string, Map<string, DecryptionAlgorithm>>();

    private deviceKeys: Record<string, string> = {}; // type: key

    public globalBlacklistUnverifiedDevices = false;
    public globalErrorOnUnknownDevices = true;

    // list of IncomingRoomKeyRequests/IncomingRoomKeyRequestCancellations
    // we received in the current sync.
    private receivedRoomKeyRequests: IncomingRoomKeyRequest[] = [];
    private receivedRoomKeyRequestCancellations: IncomingRoomKeyRequestCancellation[] = [];
    // true if we are currently processing received room key requests
    private processingRoomKeyRequests = false;
    // controls whether device tracking is delayed
    // until calling encryptEvent or trackRoomDevices,
    // or done immediately upon enabling room encryption.
    private lazyLoadMembers = false;
    // in case lazyLoadMembers is true,
    // track if an initial tracking of all the room members
    // has happened for a given room. This is delayed
    // to avoid loading room members as long as possible.
    private roomDeviceTrackingState: { [roomId: string]: Promise<void> } = {};

    // The timestamp of the last time we forced establishment
    // of a new session for each device, in milliseconds.
    // {
    //     userId: {
    //         deviceId: 1234567890000,
    //     },
    // }
    // Map: user Id → device Id → timestamp
    private lastNewSessionForced: MapWithDefault<string, MapWithDefault<string, number>> = new MapWithDefault(
        () => new MapWithDefault(() => 0),
    );

    // This flag will be unset whilst the client processes a sync response
    // so that we don't start requesting keys until we've actually finished
    // processing the response.
    private sendKeyRequestsImmediately = false;

    private oneTimeKeyCount?: number;
    private needsNewFallback?: boolean;
    private fallbackCleanup?: ReturnType<typeof setTimeout>;

    /**
     * Cryptography bits
     *
     * This module is internal to the js-sdk; the public API is via MatrixClient.
     *
     * @internal
     *
     * @param baseApis - base matrix api interface
     *
     * @param userId - The user ID for the local user
     *
     * @param deviceId - The identifier for this device.
     *
     * @param clientStore - the MatrixClient data store.
     *
     * @param cryptoStore - storage for the crypto layer.
     *
     * @param roomList - An initialised RoomList object
     *
     * @param verificationMethods - Array of verification methods to use.
     *    Each element can either be a string from MatrixClient.verificationMethods
     *    or a class that implements a verification method.
     */
    public constructor(
        public readonly baseApis: MatrixClient,
        public readonly userId: string,
        private readonly deviceId: string,
        private readonly clientStore: IStore,
        public readonly cryptoStore: CryptoStore,
        private readonly roomList: RoomList,
        verificationMethods: Array<VerificationMethod | (typeof VerificationBase & { NAME: string })>,
    ) {
        super();
        this.reEmitter = new TypedReEmitter(this);

        if (verificationMethods) {
            this.verificationMethods = new Map();
            for (const method of verificationMethods) {
                if (typeof method === "string") {
                    if (defaultVerificationMethods[method]) {
                        this.verificationMethods.set(
                            method,
                            <typeof VerificationBase>defaultVerificationMethods[method],
                        );
                    }
                } else if (method["NAME"]) {
                    this.verificationMethods.set(method["NAME"], method as typeof VerificationBase);
                } else {
                    logger.warn(`Excluding unknown verification method ${method}`);
                }
            }
        } else {
            this.verificationMethods = new Map(Object.entries(defaultVerificationMethods)) as Map<
                VerificationMethod,
                typeof VerificationBase
            >;
        }

        this.backupManager = new BackupManager(baseApis, async () => {
            // try to get key from cache
            const cachedKey = await this.getSessionBackupPrivateKey();
            if (cachedKey) {
                return cachedKey;
            }

            // try to get key from secret storage
            const storedKey = await this.secretStorage.get("m.megolm_backup.v1");

            if (storedKey) {
                // ensure that the key is in the right format.  If not, fix the key and
                // store the fixed version
                const fixedKey = fixBackupKey(storedKey);
                if (fixedKey) {
                    const keys = await this.secretStorage.getKey();
                    await this.secretStorage.store("m.megolm_backup.v1", fixedKey, [keys![0]]);
                }

                return olmlib.decodeBase64(fixedKey || storedKey);
            }

            // try to get key from app
            if (this.baseApis.cryptoCallbacks && this.baseApis.cryptoCallbacks.getBackupKey) {
                return this.baseApis.cryptoCallbacks.getBackupKey();
            }

            throw new Error("Unable to get private key");
        });

        this.olmDevice = new OlmDevice(cryptoStore);
        this.deviceList = new DeviceList(baseApis, cryptoStore, this.olmDevice);

        // XXX: This isn't removed at any point, but then none of the event listeners
        // this class sets seem to be removed at any point... :/
        this.deviceList.on(CryptoEvent.UserCrossSigningUpdated, this.onDeviceListUserCrossSigningUpdated);
        this.reEmitter.reEmit(this.deviceList, [CryptoEvent.DevicesUpdated, CryptoEvent.WillUpdateDevices]);

        this.supportedAlgorithms = Array.from(algorithms.DECRYPTION_CLASSES.keys());

        this.outgoingRoomKeyRequestManager = new OutgoingRoomKeyRequestManager(
            baseApis,
            this.deviceId,
            this.cryptoStore,
        );

        this.toDeviceVerificationRequests = new ToDeviceRequests();
        this.inRoomVerificationRequests = new InRoomRequests();

        const cryptoCallbacks = this.baseApis.cryptoCallbacks || {};
        const cacheCallbacks = createCryptoStoreCacheCallbacks(cryptoStore, this.olmDevice);

        this.crossSigningInfo = new CrossSigningInfo(userId, cryptoCallbacks, cacheCallbacks);
        // Yes, we pass the client twice here: see SecretStorage
        this.secretStorage = new LegacySecretStorage(baseApis as AccountDataClient, cryptoCallbacks, baseApis);
        this.dehydrationManager = new DehydrationManager(this);

        // Assuming no app-supplied callback, default to getting from SSSS.
        if (!cryptoCallbacks.getCrossSigningKey && cryptoCallbacks.getSecretStorageKey) {
            cryptoCallbacks.getCrossSigningKey = async (type): Promise<Uint8Array | null> => {
                return CrossSigningInfo.getFromSecretStorage(type, this.secretStorage);
            };
        }
    }

    /**
     * Initialise the crypto module so that it is ready for use
     *
     * Returns a promise which resolves once the crypto module is ready for use.
     *
     * @param exportedOlmDevice - (Optional) data from exported device
     *     that must be re-created.
     */
    public async init({ exportedOlmDevice, pickleKey }: IInitOpts = {}): Promise<void> {
        logger.log("Crypto: initialising Olm...");
        await global.Olm.init();
        logger.log(
            exportedOlmDevice
                ? "Crypto: initialising Olm device from exported device..."
                : "Crypto: initialising Olm device...",
        );
        await this.olmDevice.init({ fromExportedDevice: exportedOlmDevice, pickleKey });
        logger.log("Crypto: loading device list...");
        await this.deviceList.load();

        // build our device keys: these will later be uploaded
        this.deviceKeys["ed25519:" + this.deviceId] = this.olmDevice.deviceEd25519Key!;
        this.deviceKeys["curve25519:" + this.deviceId] = this.olmDevice.deviceCurve25519Key!;

        logger.log("Crypto: fetching own devices...");
        let myDevices = this.deviceList.getRawStoredDevicesForUser(this.userId);

        if (!myDevices) {
            myDevices = {};
        }

        if (!myDevices[this.deviceId]) {
            // add our own deviceinfo to the cryptoStore
            logger.log("Crypto: adding this device to the store...");
            const deviceInfo = {
                keys: this.deviceKeys,
                algorithms: this.supportedAlgorithms,
                verified: DeviceVerification.VERIFIED,
                known: true,
            };

            myDevices[this.deviceId] = deviceInfo;
            this.deviceList.storeDevicesForUser(this.userId, myDevices);
            this.deviceList.saveIfDirty();
        }

        await this.cryptoStore.doTxn("readonly", [IndexedDBCryptoStore.STORE_ACCOUNT], (txn) => {
            this.cryptoStore.getCrossSigningKeys(txn, (keys) => {
                // can be an empty object after resetting cross-signing keys, see storeTrustedSelfKeys
                if (keys && Object.keys(keys).length !== 0) {
                    logger.log("Loaded cross-signing public keys from crypto store");
                    this.crossSigningInfo.setKeys(keys);
                }
            });
        });
        // make sure we are keeping track of our own devices
        // (this is important for key backups & things)
        this.deviceList.startTrackingDeviceList(this.userId);

        logger.log("Crypto: checking for key backup...");
        this.backupManager.checkAndStart();
    }

    /**
     * Whether to trust a others users signatures of their devices.
     * If false, devices will only be considered 'verified' if we have
     * verified that device individually (effectively disabling cross-signing).
     *
     * Default: true
     *
     * @returns True if trusting cross-signed devices
     */
    public getTrustCrossSignedDevices(): boolean {
        return this.trustCrossSignedDevices;
    }

    /**
     * @deprecated Use {@link Crypto.CryptoApi#getTrustCrossSignedDevices}.
     */
    public getCryptoTrustCrossSignedDevices(): boolean {
        return this.trustCrossSignedDevices;
    }

    /**
     * See getCryptoTrustCrossSignedDevices
     *
     * @param val - True to trust cross-signed devices
     */
    public setTrustCrossSignedDevices(val: boolean): void {
        this.trustCrossSignedDevices = val;

        for (const userId of this.deviceList.getKnownUserIds()) {
            const devices = this.deviceList.getRawStoredDevicesForUser(userId);
            for (const deviceId of Object.keys(devices)) {
                const deviceTrust = this.checkDeviceTrust(userId, deviceId);
                // If the device is locally verified then isVerified() is always true,
                // so this will only have caused the value to change if the device is
                // cross-signing verified but not locally verified
                if (!deviceTrust.isLocallyVerified() && deviceTrust.isCrossSigningVerified()) {
                    const deviceObj = this.deviceList.getStoredDevice(userId, deviceId)!;
                    this.emit(CryptoEvent.DeviceVerificationChanged, userId, deviceId, deviceObj);
                }
            }
        }
    }

    /**
     * @deprecated Use {@link Crypto.CryptoApi#setTrustCrossSignedDevices}.
     */
    public setCryptoTrustCrossSignedDevices(val: boolean): void {
        this.setTrustCrossSignedDevices(val);
    }

    /**
     * Create a recovery key from a user-supplied passphrase.
     *
     * @param password - Passphrase string that can be entered by the user
     *     when restoring the backup as an alternative to entering the recovery key.
     *     Optional.
     * @returns Object with public key metadata, encoded private
     *     recovery key which should be disposed of after displaying to the user,
     *     and raw private key to avoid round tripping if needed.
     */
    public async createRecoveryKeyFromPassphrase(password?: string): Promise<IRecoveryKey> {
        const decryption = new global.Olm.PkDecryption();
        try {
            const keyInfo: Partial<IRecoveryKey["keyInfo"]> = {};
            if (password) {
                const derivation = await keyFromPassphrase(password);
                keyInfo.passphrase = {
                    algorithm: "m.pbkdf2",
                    iterations: derivation.iterations,
                    salt: derivation.salt,
                };
                keyInfo.pubkey = decryption.init_with_private_key(derivation.key);
            } else {
                keyInfo.pubkey = decryption.generate_key();
            }
            const privateKey = decryption.get_private_key();
            const encodedPrivateKey = encodeRecoveryKey(privateKey);
            return {
                keyInfo: keyInfo as IRecoveryKey["keyInfo"],
                encodedPrivateKey,
                privateKey,
            };
        } finally {
            decryption?.free();
        }
    }

    /**
     * Checks if the user has previously published cross-signing keys
     *
     * This means downloading the devicelist for the user and checking if the list includes
     * the cross-signing pseudo-device.
     *
     * @internal
     */
    public async userHasCrossSigningKeys(): Promise<boolean> {
        await this.downloadKeys([this.userId]);
        return this.deviceList.getStoredCrossSigningForUser(this.userId) !== null;
    }

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
     * The cross-signing API is currently UNSTABLE and may change without notice.
     *
     * @returns True if cross-signing is ready to be used on this device
     */
    public async isCrossSigningReady(): Promise<boolean> {
        const publicKeysOnDevice = this.crossSigningInfo.getId();
        const privateKeysExistSomewhere =
            (await this.crossSigningInfo.isStoredInKeyCache()) ||
            (await this.crossSigningInfo.isStoredInSecretStorage(this.secretStorage));

        return !!(publicKeysOnDevice && privateKeysExistSomewhere);
    }

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
     * The Secure Secret Storage API is currently UNSTABLE and may change without notice.
     *
     * @returns True if secret storage is ready to be used on this device
     */
    public async isSecretStorageReady(): Promise<boolean> {
        const secretStorageKeyInAccount = await this.secretStorage.hasKey();
        const privateKeysInStorage = await this.crossSigningInfo.isStoredInSecretStorage(this.secretStorage);
        const sessionBackupInStorage =
            !this.backupManager.getKeyBackupEnabled() || (await this.baseApis.isKeyBackupKeyStored());

        return !!(secretStorageKeyInAccount && privateKeysInStorage && sessionBackupInStorage);
    }

    /**
     * Implementation of {@link CryptoApi#getCrossSigningStatus}
     */
    public async getCrossSigningStatus(): Promise<CrossSigningStatus> {
        const publicKeysOnDevice = Boolean(this.crossSigningInfo.getId());
        const privateKeysInSecretStorage = Boolean(
            await this.crossSigningInfo.isStoredInSecretStorage(this.secretStorage),
        );
        const cacheCallbacks = this.crossSigningInfo.getCacheCallbacks();
        const masterKey = Boolean(await cacheCallbacks.getCrossSigningKeyCache?.("master"));
        const selfSigningKey = Boolean(await cacheCallbacks.getCrossSigningKeyCache?.("self_signing"));
        const userSigningKey = Boolean(await cacheCallbacks.getCrossSigningKeyCache?.("user_signing"));

        return {
            publicKeysOnDevice,
            privateKeysInSecretStorage,
            privateKeysCachedLocally: {
                masterKey,
                selfSigningKey,
                userSigningKey,
            },
        };
    }

    /**
     * Bootstrap cross-signing by creating keys if needed. If everything is already
     * set up, then no changes are made, so this is safe to run to ensure
     * cross-signing is ready for use.
     *
     * This function:
     * - creates new cross-signing keys if they are not found locally cached nor in
     *   secret storage (if it has been setup)
     *
     * The cross-signing API is currently UNSTABLE and may change without notice.
     *
     * @param authUploadDeviceSigningKeys - Function
     * called to await an interactive auth flow when uploading device signing keys.
     * @param setupNewCrossSigning - Optional. Reset even if keys
     * already exist.
     * Args:
     *     A function that makes the request requiring auth. Receives the
     *     auth data as an object. Can be called multiple times, first with an empty
     *     authDict, to obtain the flows.
     */
    public async bootstrapCrossSigning({
        authUploadDeviceSigningKeys,
        setupNewCrossSigning,
    }: BootstrapCrossSigningOpts = {}): Promise<void> {
        logger.log("Bootstrapping cross-signing");

        const delegateCryptoCallbacks = this.baseApis.cryptoCallbacks;
        const builder = new EncryptionSetupBuilder(this.baseApis.store.accountData, delegateCryptoCallbacks);
        const crossSigningInfo = new CrossSigningInfo(
            this.userId,
            builder.crossSigningCallbacks,
            builder.crossSigningCallbacks,
        );

        // Reset the cross-signing keys
        const resetCrossSigning = async (): Promise<void> => {
            crossSigningInfo.resetKeys();
            // Sign master key with device key
            await this.signObject(crossSigningInfo.keys.master);

            // Store auth flow helper function, as we need to call it when uploading
            // to ensure we handle auth errors properly.
            builder.addCrossSigningKeys(authUploadDeviceSigningKeys, crossSigningInfo.keys);

            // Cross-sign own device
            const device = this.deviceList.getStoredDevice(this.userId, this.deviceId)!;
            const deviceSignature = await crossSigningInfo.signDevice(this.userId, device);
            builder.addKeySignature(this.userId, this.deviceId, deviceSignature!);

            // Sign message key backup with cross-signing master key
            if (this.backupManager.backupInfo) {
                await crossSigningInfo.signObject(this.backupManager.backupInfo.auth_data, "master");
                builder.addSessionBackup(this.backupManager.backupInfo);
            }
        };

        const publicKeysOnDevice = this.crossSigningInfo.getId();
        const privateKeysInCache = await this.crossSigningInfo.isStoredInKeyCache();
        const privateKeysInStorage = await this.crossSigningInfo.isStoredInSecretStorage(this.secretStorage);
        const privateKeysExistSomewhere = privateKeysInCache || privateKeysInStorage;

        // Log all relevant state for easier parsing of debug logs.
        logger.log({
            setupNewCrossSigning,
            publicKeysOnDevice,
            privateKeysInCache,
            privateKeysInStorage,
            privateKeysExistSomewhere,
        });

        if (!privateKeysExistSomewhere || setupNewCrossSigning) {
            logger.log("Cross-signing private keys not found locally or in secret storage, " + "creating new keys");
            // If a user has multiple devices, it important to only call bootstrap
            // as part of some UI flow (and not silently during startup), as they
            // may have setup cross-signing on a platform which has not saved keys
            // to secret storage, and this would reset them. In such a case, you
            // should prompt the user to verify any existing devices first (and
            // request private keys from those devices) before calling bootstrap.
            await resetCrossSigning();
        } else if (publicKeysOnDevice && privateKeysInCache) {
            logger.log("Cross-signing public keys trusted and private keys found locally");
        } else if (privateKeysInStorage) {
            logger.log(
                "Cross-signing private keys not found locally, but they are available " +
                    "in secret storage, reading storage and caching locally",
            );
            await this.checkOwnCrossSigningTrust({
                allowPrivateKeyRequests: true,
            });
        }

        // Assuming no app-supplied callback, default to storing new private keys in
        // secret storage if it exists. If it does not, it is assumed this will be
        // done as part of setting up secret storage later.
        const crossSigningPrivateKeys = builder.crossSigningCallbacks.privateKeys;
        if (crossSigningPrivateKeys.size && !this.baseApis.cryptoCallbacks.saveCrossSigningKeys) {
            const secretStorage = new ServerSideSecretStorageImpl(
                builder.accountDataClientAdapter,
                builder.ssssCryptoCallbacks,
            );
            if (await secretStorage.hasKey()) {
                logger.log("Storing new cross-signing private keys in secret storage");
                // This is writing to in-memory account data in
                // builder.accountDataClientAdapter so won't fail
                await CrossSigningInfo.storeInSecretStorage(crossSigningPrivateKeys, secretStorage);
            }
        }

        const operation = builder.buildOperation();
        await operation.apply(this);
        // This persists private keys and public keys as trusted,
        // only do this if apply succeeded for now as retry isn't in place yet
        await builder.persist(this);

        logger.log("Cross-signing ready");
    }

    /**
     * Bootstrap Secure Secret Storage if needed by creating a default key. If everything is
     * already set up, then no changes are made, so this is safe to run to ensure secret
     * storage is ready for use.
     *
     * This function
     * - creates a new Secure Secret Storage key if no default key exists
     *   - if a key backup exists, it is migrated to store the key in the Secret
     *     Storage
     * - creates a backup if none exists, and one is requested
     * - migrates Secure Secret Storage to use the latest algorithm, if an outdated
     *   algorithm is found
     *
     * The Secure Secret Storage API is currently UNSTABLE and may change without notice.
     *
     * @param createSecretStorageKey - Optional. Function
     * called to await a secret storage key creation flow.
     *     Returns a Promise which resolves to an object with public key metadata, encoded private
     *     recovery key which should be disposed of after displaying to the user,
     *     and raw private key to avoid round tripping if needed.
     * @param keyBackupInfo - The current key backup object. If passed,
     * the passphrase and recovery key from this backup will be used.
     * @param setupNewKeyBackup - If true, a new key backup version will be
     * created and the private key stored in the new SSSS store. Ignored if keyBackupInfo
     * is supplied.
     * @param setupNewSecretStorage - Optional. Reset even if keys already exist.
     * @param getKeyBackupPassphrase - Optional. Function called to get the user's
     *     current key backup passphrase. Should return a promise that resolves with a Buffer
     *     containing the key, or rejects if the key cannot be obtained.
     * Returns:
     *     A promise which resolves to key creation data for
     *     SecretStorage#addKey: an object with `passphrase` etc fields.
     */
    // TODO this does not resolve with what it says it does
    public async bootstrapSecretStorage({
        createSecretStorageKey = async (): Promise<IRecoveryKey> => ({} as IRecoveryKey),
        keyBackupInfo,
        setupNewKeyBackup,
        setupNewSecretStorage,
        getKeyBackupPassphrase,
    }: ICreateSecretStorageOpts = {}): Promise<void> {
        logger.log("Bootstrapping Secure Secret Storage");
        const delegateCryptoCallbacks = this.baseApis.cryptoCallbacks;
        const builder = new EncryptionSetupBuilder(this.baseApis.store.accountData, delegateCryptoCallbacks);
        const secretStorage = new ServerSideSecretStorageImpl(
            builder.accountDataClientAdapter,
            builder.ssssCryptoCallbacks,
        );

        // the ID of the new SSSS key, if we create one
        let newKeyId: string | null = null;

        // create a new SSSS key and set it as default
        const createSSSS = async (opts: AddSecretStorageKeyOpts, privateKey?: Uint8Array): Promise<string> => {
            if (privateKey) {
                opts.key = privateKey;
            }

            const { keyId, keyInfo } = await secretStorage.addKey(SECRET_STORAGE_ALGORITHM_V1_AES, opts);

            if (privateKey) {
                // make the private key available to encrypt 4S secrets
                builder.ssssCryptoCallbacks.addPrivateKey(keyId, keyInfo, privateKey);
            }

            await secretStorage.setDefaultKeyId(keyId);
            return keyId;
        };

        const ensureCanCheckPassphrase = async (keyId: string, keyInfo: SecretStorageKeyDescription): Promise<void> => {
            if (!keyInfo.mac) {
                const key = await this.baseApis.cryptoCallbacks.getSecretStorageKey?.(
                    { keys: { [keyId]: keyInfo } },
                    "",
                );
                if (key) {
                    const privateKey = key[1];
                    builder.ssssCryptoCallbacks.addPrivateKey(keyId, keyInfo, privateKey);
                    const { iv, mac } = await calculateKeyCheck(privateKey);
                    keyInfo.iv = iv;
                    keyInfo.mac = mac;

                    await builder.setAccountData(`m.secret_storage.key.${keyId}`, keyInfo);
                }
            }
        };

        const signKeyBackupWithCrossSigning = async (keyBackupAuthData: IKeyBackupInfo["auth_data"]): Promise<void> => {
            if (this.crossSigningInfo.getId() && (await this.crossSigningInfo.isStoredInKeyCache("master"))) {
                try {
                    logger.log("Adding cross-signing signature to key backup");
                    await this.crossSigningInfo.signObject(keyBackupAuthData, "master");
                } catch (e) {
                    // This step is not critical (just helpful), so we catch here
                    // and continue if it fails.
                    logger.error("Signing key backup with cross-signing keys failed", e);
                }
            } else {
                logger.warn("Cross-signing keys not available, skipping signature on key backup");
            }
        };

        const oldSSSSKey = await this.secretStorage.getKey();
        const [oldKeyId, oldKeyInfo] = oldSSSSKey || [null, null];
        const storageExists =
            !setupNewSecretStorage && oldKeyInfo && oldKeyInfo.algorithm === SECRET_STORAGE_ALGORITHM_V1_AES;

        // Log all relevant state for easier parsing of debug logs.
        logger.log({
            keyBackupInfo,
            setupNewKeyBackup,
            setupNewSecretStorage,
            storageExists,
            oldKeyInfo,
        });

        if (!storageExists && !keyBackupInfo) {
            // either we don't have anything, or we've been asked to restart
            // from scratch
            logger.log("Secret storage does not exist, creating new storage key");

            // if we already have a usable default SSSS key and aren't resetting
            // SSSS just use it. otherwise, create a new one
            // Note: we leave the old SSSS key in place: there could be other
            // secrets using it, in theory. We could move them to the new key but a)
            // that would mean we'd need to prompt for the old passphrase, and b)
            // it's not clear that would be the right thing to do anyway.
            const { keyInfo = {} as AddSecretStorageKeyOpts, privateKey } = await createSecretStorageKey();
            newKeyId = await createSSSS(keyInfo, privateKey);
        } else if (!storageExists && keyBackupInfo) {
            // we have an existing backup, but no SSSS
            logger.log("Secret storage does not exist, using key backup key");

            // if we have the backup key already cached, use it; otherwise use the
            // callback to prompt for the key
            const backupKey = (await this.getSessionBackupPrivateKey()) || (await getKeyBackupPassphrase?.());

            // create a new SSSS key and use the backup key as the new SSSS key
            const opts = {} as AddSecretStorageKeyOpts;

            if (keyBackupInfo.auth_data.private_key_salt && keyBackupInfo.auth_data.private_key_iterations) {
                // FIXME: ???
                opts.passphrase = {
                    algorithm: "m.pbkdf2",
                    iterations: keyBackupInfo.auth_data.private_key_iterations,
                    salt: keyBackupInfo.auth_data.private_key_salt,
                    bits: 256,
                };
            }

            newKeyId = await createSSSS(opts, backupKey);

            // store the backup key in secret storage
            await secretStorage.store("m.megolm_backup.v1", olmlib.encodeBase64(backupKey!), [newKeyId]);

            // The backup is trusted because the user provided the private key.
            // Sign the backup with the cross-signing key so the key backup can
            // be trusted via cross-signing.
            await signKeyBackupWithCrossSigning(keyBackupInfo.auth_data);

            builder.addSessionBackup(keyBackupInfo);
        } else {
            // 4S is already set up
            logger.log("Secret storage exists");

            if (oldKeyInfo && oldKeyInfo.algorithm === SECRET_STORAGE_ALGORITHM_V1_AES) {
                // make sure that the default key has the information needed to
                // check the passphrase
                await ensureCanCheckPassphrase(oldKeyId, oldKeyInfo);
            }
        }

        // If we have cross-signing private keys cached, store them in secret
        // storage if they are not there already.
        if (
            !this.baseApis.cryptoCallbacks.saveCrossSigningKeys &&
            (await this.isCrossSigningReady()) &&
            (newKeyId || !(await this.crossSigningInfo.isStoredInSecretStorage(secretStorage)))
        ) {
            logger.log("Copying cross-signing private keys from cache to secret storage");
            const crossSigningPrivateKeys = await this.crossSigningInfo.getCrossSigningKeysFromCache();
            // This is writing to in-memory account data in
            // builder.accountDataClientAdapter so won't fail
            await CrossSigningInfo.storeInSecretStorage(crossSigningPrivateKeys, secretStorage);
        }

        if (setupNewKeyBackup && !keyBackupInfo) {
            logger.log("Creating new message key backup version");
            const info = await this.baseApis.prepareKeyBackupVersion(
                null /* random key */,
                // don't write to secret storage, as it will write to this.secretStorage.
                // Here, we want to capture all the side-effects of bootstrapping,
                // and want to write to the local secretStorage object
                { secureSecretStorage: false },
            );
            // write the key ourselves to 4S
            const privateKey = decodeRecoveryKey(info.recovery_key);
            await secretStorage.store("m.megolm_backup.v1", olmlib.encodeBase64(privateKey));

            // create keyBackupInfo object to add to builder
            const data: IKeyBackupInfo = {
                algorithm: info.algorithm,
                auth_data: info.auth_data,
            };

            // Sign with cross-signing master key
            await signKeyBackupWithCrossSigning(data.auth_data);

            // sign with the device fingerprint
            await this.signObject(data.auth_data);

            builder.addSessionBackup(data);
        }

        // Cache the session backup key
        const sessionBackupKey = await secretStorage.get("m.megolm_backup.v1");
        if (sessionBackupKey) {
            logger.info("Got session backup key from secret storage: caching");
            // fix up the backup key if it's in the wrong format, and replace
            // in secret storage
            const fixedBackupKey = fixBackupKey(sessionBackupKey);
            if (fixedBackupKey) {
                const keyId = newKeyId || oldKeyId;
                await secretStorage.store("m.megolm_backup.v1", fixedBackupKey, keyId ? [keyId] : null);
            }
            const decodedBackupKey = new Uint8Array(olmlib.decodeBase64(fixedBackupKey || sessionBackupKey));
            builder.addSessionBackupPrivateKeyToCache(decodedBackupKey);
        } else if (this.backupManager.getKeyBackupEnabled()) {
            // key backup is enabled but we don't have a session backup key in SSSS: see if we have one in
            // the cache or the user can provide one, and if so, write it to SSSS
            const backupKey = (await this.getSessionBackupPrivateKey()) || (await getKeyBackupPassphrase?.());
            if (!backupKey) {
                // This will require user intervention to recover from since we don't have the key
                // backup key anywhere. The user should probably just set up a new key backup and
                // the key for the new backup will be stored. If we hit this scenario in the wild
                // with any frequency, we should do more than just log an error.
                logger.error("Key backup is enabled but couldn't get key backup key!");
                return;
            }
            logger.info("Got session backup key from cache/user that wasn't in SSSS: saving to SSSS");
            await secretStorage.store("m.megolm_backup.v1", olmlib.encodeBase64(backupKey));
        }

        const operation = builder.buildOperation();
        await operation.apply(this);
        // this persists private keys and public keys as trusted,
        // only do this if apply succeeded for now as retry isn't in place yet
        await builder.persist(this);

        logger.log("Secure Secret Storage ready");
    }

    /**
     * @deprecated Use {@link MatrixClient#secretStorage} and {@link SecretStorage.ServerSideSecretStorage#addKey}.
     */
    public addSecretStorageKey(
        algorithm: string,
        opts: AddSecretStorageKeyOpts,
        keyID?: string,
    ): Promise<SecretStorageKeyObject> {
        return this.secretStorage.addKey(algorithm, opts, keyID);
    }

    /**
     * @deprecated Use {@link MatrixClient#secretStorage} and {@link SecretStorage.ServerSideSecretStorage#hasKey}.
     */
    public hasSecretStorageKey(keyID?: string): Promise<boolean> {
        return this.secretStorage.hasKey(keyID);
    }

    /**
     * @deprecated Use {@link MatrixClient#secretStorage} and {@link SecretStorage.ServerSideSecretStorage#getKey}.
     */
    public getSecretStorageKey(keyID?: string): Promise<SecretStorageKeyTuple | null> {
        return this.secretStorage.getKey(keyID);
    }

    /**
     * @deprecated Use {@link MatrixClient#secretStorage} and {@link SecretStorage.ServerSideSecretStorage#store}.
     */
    public storeSecret(name: string, secret: string, keys?: string[]): Promise<void> {
        return this.secretStorage.store(name, secret, keys);
    }

    /**
     * @deprecated Use {@link MatrixClient#secretStorage} and {@link SecretStorage.ServerSideSecretStorage#get}.
     */
    public getSecret(name: string): Promise<string | undefined> {
        return this.secretStorage.get(name);
    }

    /**
     * @deprecated Use {@link MatrixClient#secretStorage} and {@link SecretStorage.ServerSideSecretStorage#isStored}.
     */
    public isSecretStored(name: string): Promise<Record<string, SecretStorageKeyDescription> | null> {
        return this.secretStorage.isStored(name);
    }

    public requestSecret(name: string, devices: string[]): ISecretRequest {
        if (!devices) {
            devices = Object.keys(this.deviceList.getRawStoredDevicesForUser(this.userId));
        }
        return this.secretStorage.request(name, devices);
    }

    /**
     * @deprecated Use {@link MatrixClient#secretStorage} and {@link SecretStorage.ServerSideSecretStorage#getDefaultKeyId}.
     */
    public getDefaultSecretStorageKeyId(): Promise<string | null> {
        return this.secretStorage.getDefaultKeyId();
    }

    /**
     * @deprecated Use {@link MatrixClient#secretStorage} and {@link SecretStorage.ServerSideSecretStorage#setDefaultKeyId}.
     */
    public setDefaultSecretStorageKeyId(k: string): Promise<void> {
        return this.secretStorage.setDefaultKeyId(k);
    }

    /**
     * @deprecated Use {@link MatrixClient#secretStorage} and {@link SecretStorage.ServerSideSecretStorage#checkKey}.
     */
    public checkSecretStorageKey(key: Uint8Array, info: SecretStorageKeyDescription): Promise<boolean> {
        return this.secretStorage.checkKey(key, info);
    }

    /**
     * Checks that a given secret storage private key matches a given public key.
     * This can be used by the getSecretStorageKey callback to verify that the
     * private key it is about to supply is the one that was requested.
     *
     * @param privateKey - The private key
     * @param expectedPublicKey - The public key
     * @returns true if the key matches, otherwise false
     */
    public checkSecretStoragePrivateKey(privateKey: Uint8Array, expectedPublicKey: string): boolean {
        let decryption: PkDecryption | null = null;
        try {
            decryption = new global.Olm.PkDecryption();
            const gotPubkey = decryption.init_with_private_key(privateKey);
            // make sure it agrees with the given pubkey
            return gotPubkey === expectedPublicKey;
        } finally {
            decryption?.free();
        }
    }

    /**
     * Fetches the backup private key, if cached
     * @returns the key, if any, or null
     */
    public async getSessionBackupPrivateKey(): Promise<Uint8Array | null> {
        let key = await new Promise<any>((resolve) => {
            // TODO types
            this.cryptoStore.doTxn("readonly", [IndexedDBCryptoStore.STORE_ACCOUNT], (txn) => {
                this.cryptoStore.getSecretStorePrivateKey(txn, resolve, "m.megolm_backup.v1");
            });
        });

        // make sure we have a Uint8Array, rather than a string
        if (key && typeof key === "string") {
            key = new Uint8Array(olmlib.decodeBase64(fixBackupKey(key) || key));
            await this.storeSessionBackupPrivateKey(key);
        }
        if (key && key.ciphertext) {
            const pickleKey = Buffer.from(this.olmDevice.pickleKey);
            const decrypted = await decryptAES(key, pickleKey, "m.megolm_backup.v1");
            key = olmlib.decodeBase64(decrypted);
        }
        return key;
    }

    /**
     * Stores the session backup key to the cache
     * @param key - the private key
     * @returns a promise so you can catch failures
     */
    public async storeSessionBackupPrivateKey(key: ArrayLike<number>): Promise<void> {
        if (!(key instanceof Uint8Array)) {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            throw new Error(`storeSessionBackupPrivateKey expects Uint8Array, got ${key}`);
        }
        const pickleKey = Buffer.from(this.olmDevice.pickleKey);
        const encryptedKey = await encryptAES(olmlib.encodeBase64(key), pickleKey, "m.megolm_backup.v1");
        return this.cryptoStore.doTxn("readwrite", [IndexedDBCryptoStore.STORE_ACCOUNT], (txn) => {
            this.cryptoStore.storeSecretStorePrivateKey(txn, "m.megolm_backup.v1", encryptedKey);
        });
    }

    /**
     * Checks that a given cross-signing private key matches a given public key.
     * This can be used by the getCrossSigningKey callback to verify that the
     * private key it is about to supply is the one that was requested.
     *
     * @param privateKey - The private key
     * @param expectedPublicKey - The public key
     * @returns true if the key matches, otherwise false
     */
    public checkCrossSigningPrivateKey(privateKey: Uint8Array, expectedPublicKey: string): boolean {
        let signing: PkSigning | null = null;
        try {
            signing = new global.Olm.PkSigning();
            const gotPubkey = signing.init_with_seed(privateKey);
            // make sure it agrees with the given pubkey
            return gotPubkey === expectedPublicKey;
        } finally {
            signing?.free();
        }
    }

    /**
     * Run various follow-up actions after cross-signing keys have changed locally
     * (either by resetting the keys for the account or by getting them from secret
     * storage), such as signing the current device, upgrading device
     * verifications, etc.
     */
    private async afterCrossSigningLocalKeyChange(): Promise<void> {
        logger.info("Starting cross-signing key change post-processing");

        // sign the current device with the new key, and upload to the server
        const device = this.deviceList.getStoredDevice(this.userId, this.deviceId)!;
        const signedDevice = await this.crossSigningInfo.signDevice(this.userId, device);
        logger.info(`Starting background key sig upload for ${this.deviceId}`);

        const upload = ({ shouldEmit = false }): Promise<void> => {
            return this.baseApis
                .uploadKeySignatures({
                    [this.userId]: {
                        [this.deviceId]: signedDevice!,
                    },
                })
                .then((response) => {
                    const { failures } = response || {};
                    if (Object.keys(failures || []).length > 0) {
                        if (shouldEmit) {
                            this.baseApis.emit(
                                CryptoEvent.KeySignatureUploadFailure,
                                failures,
                                "afterCrossSigningLocalKeyChange",
                                upload, // continuation
                            );
                        }
                        throw new KeySignatureUploadError("Key upload failed", { failures });
                    }
                    logger.info(`Finished background key sig upload for ${this.deviceId}`);
                })
                .catch((e) => {
                    logger.error(`Error during background key sig upload for ${this.deviceId}`, e);
                });
        };
        upload({ shouldEmit: true });

        const shouldUpgradeCb = this.baseApis.cryptoCallbacks.shouldUpgradeDeviceVerifications;
        if (shouldUpgradeCb) {
            logger.info("Starting device verification upgrade");

            // Check all users for signatures if upgrade callback present
            // FIXME: do this in batches
            const users: Record<string, IDeviceVerificationUpgrade> = {};
            for (const [userId, crossSigningInfo] of Object.entries(this.deviceList.crossSigningInfo)) {
                const upgradeInfo = await this.checkForDeviceVerificationUpgrade(
                    userId,
                    CrossSigningInfo.fromStorage(crossSigningInfo, userId),
                );
                if (upgradeInfo) {
                    users[userId] = upgradeInfo;
                }
            }

            if (Object.keys(users).length > 0) {
                logger.info(`Found ${Object.keys(users).length} verif users to upgrade`);
                try {
                    const usersToUpgrade = await shouldUpgradeCb({ users: users });
                    if (usersToUpgrade) {
                        for (const userId of usersToUpgrade) {
                            if (userId in users) {
                                await this.baseApis.setDeviceVerified(userId, users[userId].crossSigningInfo.getId()!);
                            }
                        }
                    }
                } catch (e) {
                    logger.log("shouldUpgradeDeviceVerifications threw an error: not upgrading", e);
                }
            }

            logger.info("Finished device verification upgrade");
        }

        logger.info("Finished cross-signing key change post-processing");
    }

    /**
     * Check if a user's cross-signing key is a candidate for upgrading from device
     * verification.
     *
     * @param userId - the user whose cross-signing information is to be checked
     * @param crossSigningInfo - the cross-signing information to check
     */
    private async checkForDeviceVerificationUpgrade(
        userId: string,
        crossSigningInfo: CrossSigningInfo,
    ): Promise<IDeviceVerificationUpgrade | undefined> {
        // only upgrade if this is the first cross-signing key that we've seen for
        // them, and if their cross-signing key isn't already verified
        const trustLevel = this.crossSigningInfo.checkUserTrust(crossSigningInfo);
        if (crossSigningInfo.firstUse && !trustLevel.isVerified()) {
            const devices = this.deviceList.getRawStoredDevicesForUser(userId);
            const deviceIds = await this.checkForValidDeviceSignature(userId, crossSigningInfo.keys.master, devices);
            if (deviceIds.length) {
                return {
                    devices: deviceIds.map((deviceId) => DeviceInfo.fromStorage(devices[deviceId], deviceId)),
                    crossSigningInfo,
                };
            }
        }
    }

    /**
     * Check if the cross-signing key is signed by a verified device.
     *
     * @param userId - the user ID whose key is being checked
     * @param key - the key that is being checked
     * @param devices - the user's devices.  Should be a map from device ID
     *     to device info
     */
    private async checkForValidDeviceSignature(
        userId: string,
        key: ICrossSigningKey,
        devices: Record<string, IDevice>,
    ): Promise<string[]> {
        const deviceIds: string[] = [];
        if (devices && key.signatures && key.signatures[userId]) {
            for (const signame of Object.keys(key.signatures[userId])) {
                const [, deviceId] = signame.split(":", 2);
                if (deviceId in devices && devices[deviceId].verified === DeviceVerification.VERIFIED) {
                    try {
                        await olmlib.verifySignature(
                            this.olmDevice,
                            key,
                            userId,
                            deviceId,
                            devices[deviceId].keys[signame],
                        );
                        deviceIds.push(deviceId);
                    } catch (e) {}
                }
            }
        }
        return deviceIds;
    }

    /**
     * Get the user's cross-signing key ID.
     *
     * @param type - The type of key to get the ID of.  One of
     *     "master", "self_signing", or "user_signing".  Defaults to "master".
     *
     * @returns the key ID
     */
    public getCrossSigningKeyId(type: CrossSigningKey = CrossSigningKey.Master): Promise<string | null> {
        return Promise.resolve(this.getCrossSigningId(type));
    }

    // old name, for backwards compatibility
    public getCrossSigningId(type: string): string | null {
        return this.crossSigningInfo.getId(type);
    }

    /**
     * Get the cross signing information for a given user.
     *
     * @param userId - the user ID to get the cross-signing info for.
     *
     * @returns the cross signing information for the user.
     */
    public getStoredCrossSigningForUser(userId: string): CrossSigningInfo | null {
        return this.deviceList.getStoredCrossSigningForUser(userId);
    }

    /**
     * Check whether a given user is trusted.
     *
     * @param userId - The ID of the user to check.
     *
     * @returns
     */
    public checkUserTrust(userId: string): UserTrustLevel {
        const userCrossSigning = this.deviceList.getStoredCrossSigningForUser(userId);
        if (!userCrossSigning) {
            return new UserTrustLevel(false, false, false);
        }
        return this.crossSigningInfo.checkUserTrust(userCrossSigning);
    }

    /**
     * Check whether a given device is trusted.
     *
     * @param userId - The ID of the user whose device is to be checked.
     * @param deviceId - The ID of the device to check
     */
    public async getDeviceVerificationStatus(
        userId: string,
        deviceId: string,
    ): Promise<DeviceVerificationStatus | null> {
        const device = this.deviceList.getStoredDevice(userId, deviceId);
        if (!device) {
            return null;
        }
        return this.checkDeviceInfoTrust(userId, device);
    }

    /**
     * @deprecated Use {@link Crypto.CryptoApi.getDeviceVerificationStatus}.
     */
    public checkDeviceTrust(userId: string, deviceId: string): DeviceTrustLevel {
        const device = this.deviceList.getStoredDevice(userId, deviceId);
        return this.checkDeviceInfoTrust(userId, device);
    }

    /**
     * Check whether a given deviceinfo is trusted.
     *
     * @param userId - The ID of the user whose devices is to be checked.
     * @param device - The device info object to check
     *
     * @deprecated Use {@link Crypto.CryptoApi.getDeviceVerificationStatus}.
     */
    public checkDeviceInfoTrust(userId: string, device?: DeviceInfo): DeviceTrustLevel {
        const trustedLocally = !!device?.isVerified();

        const userCrossSigning = this.deviceList.getStoredCrossSigningForUser(userId);
        if (device && userCrossSigning) {
            // The trustCrossSignedDevices only affects trust of other people's cross-signing
            // signatures
            const trustCrossSig = this.trustCrossSignedDevices || userId === this.userId;
            return this.crossSigningInfo.checkDeviceTrust(userCrossSigning, device, trustedLocally, trustCrossSig);
        } else {
            return new DeviceTrustLevel(false, false, trustedLocally, false);
        }
    }

    /**
     * Check whether one of our own devices is cross-signed by our
     * user's stored keys, regardless of whether we trust those keys yet.
     *
     * @param deviceId - The ID of the device to check
     *
     * @returns true if the device is cross-signed
     */
    public checkIfOwnDeviceCrossSigned(deviceId: string): boolean {
        const device = this.deviceList.getStoredDevice(this.userId, deviceId);
        if (!device) return false;
        const userCrossSigning = this.deviceList.getStoredCrossSigningForUser(this.userId);
        return (
            userCrossSigning?.checkDeviceTrust(userCrossSigning, device, false, true).isCrossSigningVerified() ?? false
        );
    }

    /*
     * Event handler for DeviceList's userNewDevices event
     */
    private onDeviceListUserCrossSigningUpdated = async (userId: string): Promise<void> => {
        if (userId === this.userId) {
            // An update to our own cross-signing key.
            // Get the new key first:
            const newCrossSigning = this.deviceList.getStoredCrossSigningForUser(userId);
            const seenPubkey = newCrossSigning ? newCrossSigning.getId() : null;
            const currentPubkey = this.crossSigningInfo.getId();
            const changed = currentPubkey !== seenPubkey;

            if (currentPubkey && seenPubkey && !changed) {
                // If it's not changed, just make sure everything is up to date
                await this.checkOwnCrossSigningTrust();
            } else {
                // We'll now be in a state where cross-signing on the account is not trusted
                // because our locally stored cross-signing keys will not match the ones
                // on the server for our account. So we clear our own stored cross-signing keys,
                // effectively disabling cross-signing until the user gets verified by the device
                // that reset the keys
                this.storeTrustedSelfKeys(null);
                // emit cross-signing has been disabled
                this.emit(CryptoEvent.KeysChanged, {});
                // as the trust for our own user has changed,
                // also emit an event for this
                this.emit(CryptoEvent.UserTrustStatusChanged, this.userId, this.checkUserTrust(userId));
            }
        } else {
            await this.checkDeviceVerifications(userId);

            // Update verified before latch using the current state and save the new
            // latch value in the device list store.
            const crossSigning = this.deviceList.getStoredCrossSigningForUser(userId);
            if (crossSigning) {
                crossSigning.updateCrossSigningVerifiedBefore(this.checkUserTrust(userId).isCrossSigningVerified());
                this.deviceList.setRawStoredCrossSigningForUser(userId, crossSigning.toStorage());
            }

            this.emit(CryptoEvent.UserTrustStatusChanged, userId, this.checkUserTrust(userId));
        }
    };

    /**
     * Check the copy of our cross-signing key that we have in the device list and
     * see if we can get the private key. If so, mark it as trusted.
     */
    public async checkOwnCrossSigningTrust({
        allowPrivateKeyRequests = false,
    }: ICheckOwnCrossSigningTrustOpts = {}): Promise<void> {
        const userId = this.userId;

        // Before proceeding, ensure our cross-signing public keys have been
        // downloaded via the device list.
        await this.downloadKeys([this.userId]);

        // Also check which private keys are locally cached.
        const crossSigningPrivateKeys = await this.crossSigningInfo.getCrossSigningKeysFromCache();

        // If we see an update to our own master key, check it against the master
        // key we have and, if it matches, mark it as verified

        // First, get the new cross-signing info
        const newCrossSigning = this.deviceList.getStoredCrossSigningForUser(userId);
        if (!newCrossSigning) {
            logger.error(
                "Got cross-signing update event for user " + userId + " but no new cross-signing information found!",
            );
            return;
        }

        const seenPubkey = newCrossSigning.getId()!;
        const masterChanged = this.crossSigningInfo.getId() !== seenPubkey;
        const masterExistsNotLocallyCached = newCrossSigning.getId() && !crossSigningPrivateKeys.has("master");
        if (masterChanged) {
            logger.info("Got new master public key", seenPubkey);
        }
        if (allowPrivateKeyRequests && (masterChanged || masterExistsNotLocallyCached)) {
            logger.info("Attempting to retrieve cross-signing master private key");
            let signing: PkSigning | null = null;
            // It's important for control flow that we leave any errors alone for
            // higher levels to handle so that e.g. cancelling access properly
            // aborts any larger operation as well.
            try {
                const ret = await this.crossSigningInfo.getCrossSigningKey("master", seenPubkey);
                signing = ret[1];
                logger.info("Got cross-signing master private key");
            } finally {
                signing?.free();
            }
        }

        const oldSelfSigningId = this.crossSigningInfo.getId("self_signing");
        const oldUserSigningId = this.crossSigningInfo.getId("user_signing");

        // Update the version of our keys in our cross-signing object and the local store
        this.storeTrustedSelfKeys(newCrossSigning.keys);

        const selfSigningChanged = oldSelfSigningId !== newCrossSigning.getId("self_signing");
        const userSigningChanged = oldUserSigningId !== newCrossSigning.getId("user_signing");

        const selfSigningExistsNotLocallyCached =
            newCrossSigning.getId("self_signing") && !crossSigningPrivateKeys.has("self_signing");
        const userSigningExistsNotLocallyCached =
            newCrossSigning.getId("user_signing") && !crossSigningPrivateKeys.has("user_signing");

        const keySignatures: Record<string, ISignedKey> = {};

        if (selfSigningChanged) {
            logger.info("Got new self-signing key", newCrossSigning.getId("self_signing"));
        }
        if (allowPrivateKeyRequests && (selfSigningChanged || selfSigningExistsNotLocallyCached)) {
            logger.info("Attempting to retrieve cross-signing self-signing private key");
            let signing: PkSigning | null = null;
            try {
                const ret = await this.crossSigningInfo.getCrossSigningKey(
                    "self_signing",
                    newCrossSigning.getId("self_signing")!,
                );
                signing = ret[1];
                logger.info("Got cross-signing self-signing private key");
            } finally {
                signing?.free();
            }

            const device = this.deviceList.getStoredDevice(this.userId, this.deviceId)!;
            const signedDevice = await this.crossSigningInfo.signDevice(this.userId, device);
            keySignatures[this.deviceId] = signedDevice!;
        }
        if (userSigningChanged) {
            logger.info("Got new user-signing key", newCrossSigning.getId("user_signing"));
        }
        if (allowPrivateKeyRequests && (userSigningChanged || userSigningExistsNotLocallyCached)) {
            logger.info("Attempting to retrieve cross-signing user-signing private key");
            let signing: PkSigning | null = null;
            try {
                const ret = await this.crossSigningInfo.getCrossSigningKey(
                    "user_signing",
                    newCrossSigning.getId("user_signing")!,
                );
                signing = ret[1];
                logger.info("Got cross-signing user-signing private key");
            } finally {
                signing?.free();
            }
        }

        if (masterChanged) {
            const masterKey = this.crossSigningInfo.keys.master;
            await this.signObject(masterKey);
            const deviceSig = masterKey.signatures![this.userId]["ed25519:" + this.deviceId];
            // Include only the _new_ device signature in the upload.
            // We may have existing signatures from deleted devices, which will cause
            // the entire upload to fail.
            keySignatures[this.crossSigningInfo.getId()!] = Object.assign({} as ISignedKey, masterKey, {
                signatures: {
                    [this.userId]: {
                        ["ed25519:" + this.deviceId]: deviceSig,
                    },
                },
            });
        }

        const keysToUpload = Object.keys(keySignatures);
        if (keysToUpload.length) {
            const upload = ({ shouldEmit = false }): Promise<void> => {
                logger.info(`Starting background key sig upload for ${keysToUpload}`);
                return this.baseApis
                    .uploadKeySignatures({ [this.userId]: keySignatures })
                    .then((response) => {
                        const { failures } = response || {};
                        logger.info(`Finished background key sig upload for ${keysToUpload}`);
                        if (Object.keys(failures || []).length > 0) {
                            if (shouldEmit) {
                                this.baseApis.emit(
                                    CryptoEvent.KeySignatureUploadFailure,
                                    failures,
                                    "checkOwnCrossSigningTrust",
                                    upload,
                                );
                            }
                            throw new KeySignatureUploadError("Key upload failed", { failures });
                        }
                    })
                    .catch((e) => {
                        logger.error(`Error during background key sig upload for ${keysToUpload}`, e);
                    });
            };
            upload({ shouldEmit: true });
        }

        this.emit(CryptoEvent.UserTrustStatusChanged, userId, this.checkUserTrust(userId));

        if (masterChanged) {
            this.emit(CryptoEvent.KeysChanged, {});
            await this.afterCrossSigningLocalKeyChange();
        }

        // Now we may be able to trust our key backup
        await this.backupManager.checkKeyBackup();
        // FIXME: if we previously trusted the backup, should we automatically sign
        // the backup with the new key (if not already signed)?
    }

    /**
     * Store a set of keys as our own, trusted, cross-signing keys.
     *
     * @param keys - The new trusted set of keys
     */
    private async storeTrustedSelfKeys(keys: Record<string, ICrossSigningKey> | null): Promise<void> {
        if (keys) {
            this.crossSigningInfo.setKeys(keys);
        } else {
            this.crossSigningInfo.clearKeys();
        }
        await this.cryptoStore.doTxn("readwrite", [IndexedDBCryptoStore.STORE_ACCOUNT], (txn) => {
            this.cryptoStore.storeCrossSigningKeys(txn, this.crossSigningInfo.keys);
        });
    }

    /**
     * Check if the master key is signed by a verified device, and if so, prompt
     * the application to mark it as verified.
     *
     * @param userId - the user ID whose key should be checked
     */
    private async checkDeviceVerifications(userId: string): Promise<void> {
        const shouldUpgradeCb = this.baseApis.cryptoCallbacks.shouldUpgradeDeviceVerifications;
        if (!shouldUpgradeCb) {
            // Upgrading skipped when callback is not present.
            return;
        }
        logger.info(`Starting device verification upgrade for ${userId}`);
        if (this.crossSigningInfo.keys.user_signing) {
            const crossSigningInfo = this.deviceList.getStoredCrossSigningForUser(userId);
            if (crossSigningInfo) {
                const upgradeInfo = await this.checkForDeviceVerificationUpgrade(userId, crossSigningInfo);
                if (upgradeInfo) {
                    const usersToUpgrade = await shouldUpgradeCb({
                        users: {
                            [userId]: upgradeInfo,
                        },
                    });
                    if (usersToUpgrade.includes(userId)) {
                        await this.baseApis.setDeviceVerified(userId, crossSigningInfo.getId()!);
                    }
                }
            }
        }
        logger.info(`Finished device verification upgrade for ${userId}`);
    }

    /**
     */
    public enableLazyLoading(): void {
        this.lazyLoadMembers = true;
    }

    /**
     * Tell the crypto module to register for MatrixClient events which it needs to
     * listen for
     *
     * @param eventEmitter - event source where we can register
     *    for event notifications
     */
    public registerEventHandlers(
        eventEmitter: TypedEventEmitter<
            RoomMemberEvent.Membership | ClientEvent.ToDeviceEvent | RoomEvent.Timeline | MatrixEventEvent.Decrypted,
            any
        >,
    ): void {
        eventEmitter.on(RoomMemberEvent.Membership, this.onMembership);
        eventEmitter.on(ClientEvent.ToDeviceEvent, this.onToDeviceEvent);
        eventEmitter.on(RoomEvent.Timeline, this.onTimelineEvent);
        eventEmitter.on(MatrixEventEvent.Decrypted, this.onTimelineEvent);
    }

    /**
     * @deprecated this does nothing and will be removed in a future version
     */
    public start(): void {
        logger.warn("MatrixClient.crypto.start() is deprecated");
    }

    /** Stop background processes related to crypto */
    public stop(): void {
        this.outgoingRoomKeyRequestManager.stop();
        this.deviceList.stop();
        this.dehydrationManager.stop();
    }

    /**
     * Get the Ed25519 key for this device
     *
     * @returns base64-encoded ed25519 key.
     */
    public getDeviceEd25519Key(): string | null {
        return this.olmDevice.deviceEd25519Key;
    }

    /**
     * Get the Curve25519 key for this device
     *
     * @returns base64-encoded curve25519 key.
     */
    public getDeviceCurve25519Key(): string | null {
        return this.olmDevice.deviceCurve25519Key;
    }

    /**
     * Set the global override for whether the client should ever send encrypted
     * messages to unverified devices.  This provides the default for rooms which
     * do not specify a value.
     *
     * @param value - whether to blacklist all unverified devices by default
     *
     * @deprecated Set {@link Crypto.CryptoApi#globalBlacklistUnverifiedDevices | CryptoApi.globalBlacklistUnverifiedDevices} directly.
     */
    public setGlobalBlacklistUnverifiedDevices(value: boolean): void {
        this.globalBlacklistUnverifiedDevices = value;
    }

    /**
     * @returns whether to blacklist all unverified devices by default
     *
     * @deprecated Reference {@link Crypto.CryptoApi#globalBlacklistUnverifiedDevices | CryptoApi.globalBlacklistUnverifiedDevices} directly.
     */
    public getGlobalBlacklistUnverifiedDevices(): boolean {
        return this.globalBlacklistUnverifiedDevices;
    }

    /**
     * Upload the device keys to the homeserver.
     * @returns A promise that will resolve when the keys are uploaded.
     */
    public uploadDeviceKeys(): Promise<IKeysUploadResponse> {
        const deviceKeys = {
            algorithms: this.supportedAlgorithms,
            device_id: this.deviceId,
            keys: this.deviceKeys,
            user_id: this.userId,
        };

        return this.signObject(deviceKeys).then(() => {
            return this.baseApis.uploadKeysRequest({
                device_keys: deviceKeys as Required<IDeviceKeys>,
            });
        });
    }

    public getNeedsNewFallback(): boolean {
        return !!this.needsNewFallback;
    }

    // check if it's time to upload one-time keys, and do so if so.
    private maybeUploadOneTimeKeys(): void {
        // frequency with which to check & upload one-time keys
        const uploadPeriod = 1000 * 60; // one minute

        // max number of keys to upload at once
        // Creating keys can be an expensive operation so we limit the
        // number we generate in one go to avoid blocking the application
        // for too long.
        const maxKeysPerCycle = 5;

        if (this.oneTimeKeyCheckInProgress) {
            return;
        }

        const now = Date.now();
        if (this.lastOneTimeKeyCheck !== null && now - this.lastOneTimeKeyCheck < uploadPeriod) {
            // we've done a key upload recently.
            return;
        }

        this.lastOneTimeKeyCheck = now;

        // We need to keep a pool of one time public keys on the server so that
        // other devices can start conversations with us. But we can only store
        // a finite number of private keys in the olm Account object.
        // To complicate things further then can be a delay between a device
        // claiming a public one time key from the server and it sending us a
        // message. We need to keep the corresponding private key locally until
        // we receive the message.
        // But that message might never arrive leaving us stuck with duff
        // private keys clogging up our local storage.
        // So we need some kind of engineering compromise to balance all of
        // these factors.

        // Check how many keys we can store in the Account object.
        const maxOneTimeKeys = this.olmDevice.maxNumberOfOneTimeKeys();
        // Try to keep at most half that number on the server. This leaves the
        // rest of the slots free to hold keys that have been claimed from the
        // server but we haven't received a message for.
        // If we run out of slots when generating new keys then olm will
        // discard the oldest private keys first. This will eventually clean
        // out stale private keys that won't receive a message.
        const keyLimit = Math.floor(maxOneTimeKeys / 2);

        const uploadLoop = async (keyCount: number): Promise<void> => {
            while (keyLimit > keyCount || this.getNeedsNewFallback()) {
                // Ask olm to generate new one time keys, then upload them to synapse.
                if (keyLimit > keyCount) {
                    logger.info("generating oneTimeKeys");
                    const keysThisLoop = Math.min(keyLimit - keyCount, maxKeysPerCycle);
                    await this.olmDevice.generateOneTimeKeys(keysThisLoop);
                }

                if (this.getNeedsNewFallback()) {
                    const fallbackKeys = await this.olmDevice.getFallbackKey();
                    // if fallbackKeys is non-empty, we've already generated a
                    // fallback key, but it hasn't been published yet, so we
                    // can use that instead of generating a new one
                    if (!fallbackKeys.curve25519 || Object.keys(fallbackKeys.curve25519).length == 0) {
                        logger.info("generating fallback key");
                        if (this.fallbackCleanup) {
                            // cancel any pending fallback cleanup because generating
                            // a new fallback key will already drop the old fallback
                            // that would have been dropped, and we don't want to kill
                            // the current key
                            clearTimeout(this.fallbackCleanup);
                            delete this.fallbackCleanup;
                        }
                        await this.olmDevice.generateFallbackKey();
                    }
                }

                logger.info("calling uploadOneTimeKeys");
                const res = await this.uploadOneTimeKeys();
                if (res.one_time_key_counts && res.one_time_key_counts.signed_curve25519) {
                    // if the response contains a more up to date value use this
                    // for the next loop
                    keyCount = res.one_time_key_counts.signed_curve25519;
                } else {
                    throw new Error(
                        "response for uploading keys does not contain " + "one_time_key_counts.signed_curve25519",
                    );
                }
            }
        };

        this.oneTimeKeyCheckInProgress = true;
        Promise.resolve()
            .then(() => {
                if (this.oneTimeKeyCount !== undefined) {
                    // We already have the current one_time_key count from a /sync response.
                    // Use this value instead of asking the server for the current key count.
                    return Promise.resolve(this.oneTimeKeyCount);
                }
                // ask the server how many keys we have
                return this.baseApis.uploadKeysRequest({}).then((res) => {
                    return res.one_time_key_counts.signed_curve25519 || 0;
                });
            })
            .then((keyCount) => {
                // Start the uploadLoop with the current keyCount. The function checks if
                // we need to upload new keys or not.
                // If there are too many keys on the server then we don't need to
                // create any more keys.
                return uploadLoop(keyCount);
            })
            .catch((e) => {
                logger.error("Error uploading one-time keys", e.stack || e);
            })
            .finally(() => {
                // reset oneTimeKeyCount to prevent start uploading based on old data.
                // it will be set again on the next /sync-response
                this.oneTimeKeyCount = undefined;
                this.oneTimeKeyCheckInProgress = false;
            });
    }

    // returns a promise which resolves to the response
    private async uploadOneTimeKeys(): Promise<IKeysUploadResponse> {
        const promises: Promise<unknown>[] = [];

        let fallbackJson: Record<string, IOneTimeKey> | undefined;
        if (this.getNeedsNewFallback()) {
            fallbackJson = {};
            const fallbackKeys = await this.olmDevice.getFallbackKey();
            for (const [keyId, key] of Object.entries(fallbackKeys.curve25519)) {
                const k = { key, fallback: true };
                fallbackJson["signed_curve25519:" + keyId] = k;
                promises.push(this.signObject(k));
            }
            this.needsNewFallback = false;
        }

        const oneTimeKeys = await this.olmDevice.getOneTimeKeys();
        const oneTimeJson: Record<string, { key: string }> = {};

        for (const keyId in oneTimeKeys.curve25519) {
            if (oneTimeKeys.curve25519.hasOwnProperty(keyId)) {
                const k = {
                    key: oneTimeKeys.curve25519[keyId],
                };
                oneTimeJson["signed_curve25519:" + keyId] = k;
                promises.push(this.signObject(k));
            }
        }

        await Promise.all(promises);

        const requestBody: Record<string, any> = {
            one_time_keys: oneTimeJson,
        };

        if (fallbackJson) {
            requestBody["org.matrix.msc2732.fallback_keys"] = fallbackJson;
            requestBody["fallback_keys"] = fallbackJson;
        }

        const res = await this.baseApis.uploadKeysRequest(requestBody);

        if (fallbackJson) {
            this.fallbackCleanup = setTimeout(() => {
                delete this.fallbackCleanup;
                this.olmDevice.forgetOldFallbackKey();
            }, 60 * 60 * 1000);
        }

        await this.olmDevice.markKeysAsPublished();
        return res;
    }

    /**
     * Download the keys for a list of users and stores the keys in the session
     * store.
     * @param userIds - The users to fetch.
     * @param forceDownload - Always download the keys even if cached.
     *
     * @returns A promise which resolves to a map `userId->deviceId->{@link DeviceInfo}`.
     */
    public downloadKeys(userIds: string[], forceDownload?: boolean): Promise<DeviceInfoMap> {
        return this.deviceList.downloadKeys(userIds, !!forceDownload);
    }

    /**
     * Get the stored device keys for a user id
     *
     * @param userId - the user to list keys for.
     *
     * @returns list of devices, or null if we haven't
     * managed to get a list of devices for this user yet.
     */
    public getStoredDevicesForUser(userId: string): Array<DeviceInfo> | null {
        return this.deviceList.getStoredDevicesForUser(userId);
    }

    /**
     * Get the device information for the given list of users.
     *
     * @param userIds - The users to fetch.
     * @param downloadUncached - If true, download the device list for users whose device list we are not
     *    currently tracking. Defaults to false, in which case such users will not appear at all in the result map.
     *
     * @returns A map `{@link DeviceMap}`.
     */
    public async getUserDeviceInfo(userIds: string[], downloadUncached = false): Promise<DeviceMap> {
        const deviceMapByUserId = new Map<string, Map<string, Device>>();
        // Keep the users without device to download theirs keys
        const usersWithoutDeviceInfo: string[] = [];

        for (const userId of userIds) {
            const deviceInfos = await this.getStoredDevicesForUser(userId);
            // If there are device infos for a userId, we transform it into a map
            // Else, the keys will be downloaded after
            if (deviceInfos) {
                const deviceMap = new Map(
                    // Convert DeviceInfo to Device
                    deviceInfos.map((deviceInfo) => [deviceInfo.deviceId, deviceInfoToDevice(deviceInfo, userId)]),
                );
                deviceMapByUserId.set(userId, deviceMap);
            } else {
                usersWithoutDeviceInfo.push(userId);
            }
        }

        // Download device info for users without device infos
        if (downloadUncached && usersWithoutDeviceInfo.length > 0) {
            const newDeviceInfoMap = await this.downloadKeys(usersWithoutDeviceInfo);

            newDeviceInfoMap.forEach((deviceInfoMap, userId) => {
                const deviceMap = new Map<string, Device>();
                // Convert DeviceInfo to Device
                deviceInfoMap.forEach((deviceInfo, deviceId) =>
                    deviceMap.set(deviceId, deviceInfoToDevice(deviceInfo, userId)),
                );

                // Put the new device infos into the returned map
                deviceMapByUserId.set(userId, deviceMap);
            });
        }

        return deviceMapByUserId;
    }

    /**
     * Get the stored keys for a single device
     *
     *
     * @returns device, or undefined
     * if we don't know about this device
     */
    public getStoredDevice(userId: string, deviceId: string): DeviceInfo | undefined {
        return this.deviceList.getStoredDevice(userId, deviceId);
    }

    /**
     * Save the device list, if necessary
     *
     * @param delay - Time in ms before which the save actually happens.
     *     By default, the save is delayed for a short period in order to batch
     *     multiple writes, but this behaviour can be disabled by passing 0.
     *
     * @returns true if the data was saved, false if
     *     it was not (eg. because no changes were pending). The promise
     *     will only resolve once the data is saved, so may take some time
     *     to resolve.
     */
    public saveDeviceList(delay: number): Promise<boolean> {
        return this.deviceList.saveIfDirty(delay);
    }

    /**
     * Update the blocked/verified state of the given device
     *
     * @param userId - owner of the device
     * @param deviceId - unique identifier for the device or user's
     * cross-signing public key ID.
     *
     * @param verified - whether to mark the device as verified. Null to
     *     leave unchanged.
     *
     * @param blocked - whether to mark the device as blocked. Null to
     *      leave unchanged.
     *
     * @param known - whether to mark that the user has been made aware of
     *      the existence of this device. Null to leave unchanged
     *
     * @param keys - The list of keys that was present
     * during the device verification. This will be double checked with the list
     * of keys the given device has currently.
     *
     * @returns updated DeviceInfo
     */
    public async setDeviceVerification(
        userId: string,
        deviceId: string,
        verified: boolean | null = null,
        blocked: boolean | null = null,
        known: boolean | null = null,
        keys?: Record<string, string>,
    ): Promise<DeviceInfo | CrossSigningInfo> {
        // Check if the 'device' is actually a cross signing key
        // The js-sdk's verification treats cross-signing keys as devices
        // and so uses this method to mark them verified.
        const xsk = this.deviceList.getStoredCrossSigningForUser(userId);
        if (xsk && xsk.getId() === deviceId) {
            if (blocked !== null || known !== null) {
                throw new Error("Cannot set blocked or known for a cross-signing key");
            }
            if (!verified) {
                throw new Error("Cannot set a cross-signing key as unverified");
            }
            const gotKeyId = keys ? Object.values(keys)[0] : null;
            if (keys && (Object.values(keys).length !== 1 || gotKeyId !== xsk.getId())) {
                throw new Error(`Key did not match expected value: expected ${xsk.getId()}, got ${gotKeyId}`);
            }

            if (!this.crossSigningInfo.getId() && userId === this.crossSigningInfo.userId) {
                this.storeTrustedSelfKeys(xsk.keys);
                // This will cause our own user trust to change, so emit the event
                this.emit(CryptoEvent.UserTrustStatusChanged, this.userId, this.checkUserTrust(userId));
            }

            // Now sign the master key with our user signing key (unless it's ourself)
            if (userId !== this.userId) {
                logger.info("Master key " + xsk.getId() + " for " + userId + " marked verified. Signing...");
                const device = await this.crossSigningInfo.signUser(xsk);
                if (device) {
                    const upload = async ({ shouldEmit = false }): Promise<void> => {
                        logger.info("Uploading signature for " + userId + "...");
                        const response = await this.baseApis.uploadKeySignatures({
                            [userId]: {
                                [deviceId]: device,
                            },
                        });
                        const { failures } = response || {};
                        if (Object.keys(failures || []).length > 0) {
                            if (shouldEmit) {
                                this.baseApis.emit(
                                    CryptoEvent.KeySignatureUploadFailure,
                                    failures,
                                    "setDeviceVerification",
                                    upload,
                                );
                            }
                            /* Throwing here causes the process to be cancelled and the other
                             * user to be notified */
                            throw new KeySignatureUploadError("Key upload failed", { failures });
                        }
                    };
                    await upload({ shouldEmit: true });

                    // This will emit events when it comes back down the sync
                    // (we could do local echo to speed things up)
                }
                return device as any; // TODO types
            } else {
                return xsk;
            }
        }

        const devices = this.deviceList.getRawStoredDevicesForUser(userId);
        if (!devices || !devices[deviceId]) {
            throw new Error("Unknown device " + userId + ":" + deviceId);
        }

        const dev = devices[deviceId];
        let verificationStatus = dev.verified;

        if (verified) {
            if (keys) {
                for (const [keyId, key] of Object.entries(keys)) {
                    if (dev.keys[keyId] !== key) {
                        throw new Error(`Key did not match expected value: expected ${key}, got ${dev.keys[keyId]}`);
                    }
                }
            }
            verificationStatus = DeviceVerification.VERIFIED;
        } else if (verified !== null && verificationStatus == DeviceVerification.VERIFIED) {
            verificationStatus = DeviceVerification.UNVERIFIED;
        }

        if (blocked) {
            verificationStatus = DeviceVerification.BLOCKED;
        } else if (blocked !== null && verificationStatus == DeviceVerification.BLOCKED) {
            verificationStatus = DeviceVerification.UNVERIFIED;
        }

        let knownStatus = dev.known;
        if (known !== null) {
            knownStatus = known;
        }

        if (dev.verified !== verificationStatus || dev.known !== knownStatus) {
            dev.verified = verificationStatus;
            dev.known = knownStatus;
            this.deviceList.storeDevicesForUser(userId, devices);
            this.deviceList.saveIfDirty();
        }

        // do cross-signing
        if (verified && userId === this.userId) {
            logger.info("Own device " + deviceId + " marked verified: signing");

            // Signing only needed if other device not already signed
            let device: ISignedKey | undefined;
            const deviceTrust = this.checkDeviceTrust(userId, deviceId);
            if (deviceTrust.isCrossSigningVerified()) {
                logger.log(`Own device ${deviceId} already cross-signing verified`);
            } else {
                device = (await this.crossSigningInfo.signDevice(userId, DeviceInfo.fromStorage(dev, deviceId)))!;
            }

            if (device) {
                const upload = async ({ shouldEmit = false }): Promise<void> => {
                    logger.info("Uploading signature for " + deviceId);
                    const response = await this.baseApis.uploadKeySignatures({
                        [userId]: {
                            [deviceId]: device!,
                        },
                    });
                    const { failures } = response || {};
                    if (Object.keys(failures || []).length > 0) {
                        if (shouldEmit) {
                            this.baseApis.emit(
                                CryptoEvent.KeySignatureUploadFailure,
                                failures,
                                "setDeviceVerification",
                                upload, // continuation
                            );
                        }
                        throw new KeySignatureUploadError("Key upload failed", { failures });
                    }
                };
                await upload({ shouldEmit: true });
                // XXX: we'll need to wait for the device list to be updated
            }
        }

        const deviceObj = DeviceInfo.fromStorage(dev, deviceId);
        this.emit(CryptoEvent.DeviceVerificationChanged, userId, deviceId, deviceObj);
        return deviceObj;
    }

    public findVerificationRequestDMInProgress(roomId: string): VerificationRequest | undefined {
        return this.inRoomVerificationRequests.findRequestInProgress(roomId);
    }

    public getVerificationRequestsToDeviceInProgress(userId: string): VerificationRequest[] {
        return this.toDeviceVerificationRequests.getRequestsInProgress(userId);
    }

    public requestVerificationDM(userId: string, roomId: string): Promise<VerificationRequest> {
        const existingRequest = this.inRoomVerificationRequests.findRequestInProgress(roomId);
        if (existingRequest) {
            return Promise.resolve(existingRequest);
        }
        const channel = new InRoomChannel(this.baseApis, roomId, userId);
        return this.requestVerificationWithChannel(userId, channel, this.inRoomVerificationRequests);
    }

    public requestVerification(userId: string, devices?: string[]): Promise<VerificationRequest> {
        if (!devices) {
            devices = Object.keys(this.deviceList.getRawStoredDevicesForUser(userId));
        }
        const existingRequest = this.toDeviceVerificationRequests.findRequestInProgress(userId, devices);
        if (existingRequest) {
            return Promise.resolve(existingRequest);
        }
        const channel = new ToDeviceChannel(this.baseApis, userId, devices, ToDeviceChannel.makeTransactionId());
        return this.requestVerificationWithChannel(userId, channel, this.toDeviceVerificationRequests);
    }

    private async requestVerificationWithChannel(
        userId: string,
        channel: IVerificationChannel,
        requestsMap: IRequestsMap,
    ): Promise<VerificationRequest> {
        let request = new VerificationRequest(channel, this.verificationMethods, this.baseApis);
        // if transaction id is already known, add request
        if (channel.transactionId) {
            requestsMap.setRequestByChannel(channel, request);
        }
        await request.sendRequest();
        // don't replace the request created by a racing remote echo
        const racingRequest = requestsMap.getRequestByChannel(channel);
        if (racingRequest) {
            request = racingRequest;
        } else {
            logger.log(
                `Crypto: adding new request to ` + `requestsByTxnId with id ${channel.transactionId} ${channel.roomId}`,
            );
            requestsMap.setRequestByChannel(channel, request);
        }
        return request;
    }

    public beginKeyVerification(
        method: string,
        userId: string,
        deviceId: string,
        transactionId: string | null = null,
    ): VerificationBase<any, any> {
        let request: Request | undefined;
        if (transactionId) {
            request = this.toDeviceVerificationRequests.getRequestBySenderAndTxnId(userId, transactionId);
            if (!request) {
                throw new Error(`No request found for user ${userId} with ` + `transactionId ${transactionId}`);
            }
        } else {
            transactionId = ToDeviceChannel.makeTransactionId();
            const channel = new ToDeviceChannel(this.baseApis, userId, [deviceId], transactionId, deviceId);
            request = new VerificationRequest(channel, this.verificationMethods, this.baseApis);
            this.toDeviceVerificationRequests.setRequestBySenderAndTxnId(userId, transactionId, request);
        }
        return request.beginKeyVerification(method, { userId, deviceId });
    }

    public async legacyDeviceVerification(
        userId: string,
        deviceId: string,
        method: VerificationMethod,
    ): Promise<VerificationRequest> {
        const transactionId = ToDeviceChannel.makeTransactionId();
        const channel = new ToDeviceChannel(this.baseApis, userId, [deviceId], transactionId, deviceId);
        const request = new VerificationRequest(channel, this.verificationMethods, this.baseApis);
        this.toDeviceVerificationRequests.setRequestBySenderAndTxnId(userId, transactionId, request);
        const verifier = request.beginKeyVerification(method, { userId, deviceId });
        // either reject by an error from verify() while sending .start
        // or resolve when the request receives the
        // local (fake remote) echo for sending the .start event
        await Promise.race([verifier.verify(), request.waitFor((r) => r.started)]);
        return request;
    }

    /**
     * Get information on the active olm sessions with a user
     * <p>
     * Returns a map from device id to an object with keys 'deviceIdKey' (the
     * device's curve25519 identity key) and 'sessions' (an array of objects in the
     * same format as that returned by
     * {@link OlmDevice#getSessionInfoForDevice}).
     * <p>
     * This method is provided for debugging purposes.
     *
     * @param userId - id of user to inspect
     */
    public async getOlmSessionsForUser(userId: string): Promise<Record<string, IUserOlmSession>> {
        const devices = this.getStoredDevicesForUser(userId) || [];
        const result: { [deviceId: string]: IUserOlmSession } = {};
        for (const device of devices) {
            const deviceKey = device.getIdentityKey();
            const sessions = await this.olmDevice.getSessionInfoForDevice(deviceKey);

            result[device.deviceId] = {
                deviceIdKey: deviceKey,
                sessions: sessions,
            };
        }
        return result;
    }

    /**
     * Get the device which sent an event
     *
     * @param event - event to be checked
     */
    public getEventSenderDeviceInfo(event: MatrixEvent): DeviceInfo | null {
        const senderKey = event.getSenderKey();
        const algorithm = event.getWireContent().algorithm;

        if (!senderKey || !algorithm) {
            return null;
        }

        if (event.isKeySourceUntrusted()) {
            // we got the key for this event from a source that we consider untrusted
            return null;
        }

        // senderKey is the Curve25519 identity key of the device which the event
        // was sent from. In the case of Megolm, it's actually the Curve25519
        // identity key of the device which set up the Megolm session.

        const device = this.deviceList.getDeviceByIdentityKey(algorithm, senderKey);

        if (device === null) {
            // we haven't downloaded the details of this device yet.
            return null;
        }

        // so far so good, but now we need to check that the sender of this event
        // hadn't advertised someone else's Curve25519 key as their own. We do that
        // by checking the Ed25519 claimed by the event (or, in the case of megolm,
        // the event which set up the megolm session), to check that it matches the
        // fingerprint of the purported sending device.
        //
        // (see https://github.com/vector-im/vector-web/issues/2215)

        const claimedKey = event.getClaimedEd25519Key();
        if (!claimedKey) {
            logger.warn("Event " + event.getId() + " claims no ed25519 key: " + "cannot verify sending device");
            return null;
        }

        if (claimedKey !== device.getFingerprint()) {
            logger.warn(
                "Event " +
                    event.getId() +
                    " claims ed25519 key " +
                    claimedKey +
                    " but sender device has key " +
                    device.getFingerprint(),
            );
            return null;
        }

        return device;
    }

    /**
     * Get information about the encryption of an event
     *
     * @param event - event to be checked
     *
     * @returns An object with the fields:
     *    - encrypted: whether the event is encrypted (if not encrypted, some of the
     *      other properties may not be set)
     *    - senderKey: the sender's key
     *    - algorithm: the algorithm used to encrypt the event
     *    - authenticated: whether we can be sure that the owner of the senderKey
     *      sent the event
     *    - sender: the sender's device information, if available
     *    - mismatchedSender: if the event's ed25519 and curve25519 keys don't match
     *      (only meaningful if `sender` is set)
     */
    public getEventEncryptionInfo(event: MatrixEvent): IEncryptedEventInfo {
        const ret: Partial<IEncryptedEventInfo> = {};

        ret.senderKey = event.getSenderKey() ?? undefined;
        ret.algorithm = event.getWireContent().algorithm;

        if (!ret.senderKey || !ret.algorithm) {
            ret.encrypted = false;
            return ret as IEncryptedEventInfo;
        }
        ret.encrypted = true;

        if (event.isKeySourceUntrusted()) {
            // we got the key this event from somewhere else
            // TODO: check if we can trust the forwarders.
            ret.authenticated = false;
        } else {
            ret.authenticated = true;
        }

        // senderKey is the Curve25519 identity key of the device which the event
        // was sent from. In the case of Megolm, it's actually the Curve25519
        // identity key of the device which set up the Megolm session.

        ret.sender = this.deviceList.getDeviceByIdentityKey(ret.algorithm, ret.senderKey) ?? undefined;

        // so far so good, but now we need to check that the sender of this event
        // hadn't advertised someone else's Curve25519 key as their own. We do that
        // by checking the Ed25519 claimed by the event (or, in the case of megolm,
        // the event which set up the megolm session), to check that it matches the
        // fingerprint of the purported sending device.
        //
        // (see https://github.com/vector-im/vector-web/issues/2215)

        const claimedKey = event.getClaimedEd25519Key();
        if (!claimedKey) {
            logger.warn("Event " + event.getId() + " claims no ed25519 key: " + "cannot verify sending device");
            ret.mismatchedSender = true;
        }

        if (ret.sender && claimedKey !== ret.sender.getFingerprint()) {
            logger.warn(
                "Event " +
                    event.getId() +
                    " claims ed25519 key " +
                    claimedKey +
                    "but sender device has key " +
                    ret.sender.getFingerprint(),
            );
            ret.mismatchedSender = true;
        }

        return ret as IEncryptedEventInfo;
    }

    /**
     * Forces the current outbound group session to be discarded such
     * that another one will be created next time an event is sent.
     *
     * @param roomId - The ID of the room to discard the session for
     *
     * This should not normally be necessary.
     */
    public forceDiscardSession(roomId: string): Promise<void> {
        const alg = this.roomEncryptors.get(roomId);
        if (alg === undefined) throw new Error("Room not encrypted");
        if (alg.forceDiscardSession === undefined) {
            throw new Error("Room encryption algorithm doesn't support session discarding");
        }
        alg.forceDiscardSession();
        return Promise.resolve();
    }

    /**
     * Configure a room to use encryption (ie, save a flag in the cryptoStore).
     *
     * @param roomId - The room ID to enable encryption in.
     *
     * @param config - The encryption config for the room.
     *
     * @param inhibitDeviceQuery - true to suppress device list query for
     *   users in the room (for now). In case lazy loading is enabled,
     *   the device query is always inhibited as the members are not tracked.
     *
     * @deprecated It is normally incorrect to call this method directly. Encryption
     *   is enabled by receiving an `m.room.encryption` event (which we may have sent
     *   previously).
     */
    public async setRoomEncryption(
        roomId: string,
        config: IRoomEncryption,
        inhibitDeviceQuery?: boolean,
    ): Promise<void> {
        const room = this.clientStore.getRoom(roomId);
        if (!room) {
            throw new Error(`Unable to enable encryption tracking devices in unknown room ${roomId}`);
        }
        await this.setRoomEncryptionImpl(room, config);
        if (!this.lazyLoadMembers && !inhibitDeviceQuery) {
            this.deviceList.refreshOutdatedDeviceLists();
        }
    }

    /**
     * Set up encryption for a room.
     *
     * This is called when an <tt>m.room.encryption</tt> event is received. It saves a flag
     * for the room in the cryptoStore (if it wasn't already set), sets up an "encryptor" for
     * the room, and enables device-list tracking for the room.
     *
     * It does <em>not</em> initiate a device list query for the room. That is normally
     * done once we finish processing the sync, in onSyncCompleted.
     *
     * @param room - The room to enable encryption in.
     * @param config - The encryption config for the room.
     */
    private async setRoomEncryptionImpl(room: Room, config: IRoomEncryption): Promise<void> {
        const roomId = room.roomId;

        // ignore crypto events with no algorithm defined
        // This will happen if a crypto event is redacted before we fetch the room state
        // It would otherwise just throw later as an unknown algorithm would, but we may
        // as well catch this here
        if (!config.algorithm) {
            logger.log("Ignoring setRoomEncryption with no algorithm");
            return;
        }

        // if state is being replayed from storage, we might already have a configuration
        // for this room as they are persisted as well.
        // We just need to make sure the algorithm is initialized in this case.
        // However, if the new config is different,
        // we should bail out as room encryption can't be changed once set.
        const existingConfig = this.roomList.getRoomEncryption(roomId);
        if (existingConfig) {
            if (JSON.stringify(existingConfig) != JSON.stringify(config)) {
                logger.error("Ignoring m.room.encryption event which requests " + "a change of config in " + roomId);
                return;
            }
        }
        // if we already have encryption in this room, we should ignore this event,
        // as it would reset the encryption algorithm.
        // This is at least expected to be called twice, as sync calls onCryptoEvent
        // for both the timeline and state sections in the /sync response,
        // the encryption event would appear in both.
        // If it's called more than twice though,
        // it signals a bug on client or server.
        const existingAlg = this.roomEncryptors.get(roomId);
        if (existingAlg) {
            return;
        }

        // _roomList.getRoomEncryption will not race with _roomList.setRoomEncryption
        // because it first stores in memory. We should await the promise only
        // after all the in-memory state (roomEncryptors and _roomList) has been updated
        // to avoid races when calling this method multiple times. Hence keep a hold of the promise.
        let storeConfigPromise: Promise<void> | null = null;
        if (!existingConfig) {
            storeConfigPromise = this.roomList.setRoomEncryption(roomId, config);
        }

        const AlgClass = algorithms.ENCRYPTION_CLASSES.get(config.algorithm);
        if (!AlgClass) {
            throw new Error("Unable to encrypt with " + config.algorithm);
        }

        const alg = new AlgClass({
            userId: this.userId,
            deviceId: this.deviceId,
            crypto: this,
            olmDevice: this.olmDevice,
            baseApis: this.baseApis,
            roomId,
            config,
        });
        this.roomEncryptors.set(roomId, alg);

        if (storeConfigPromise) {
            await storeConfigPromise;
        }

        logger.log(`Enabling encryption in ${roomId}`);

        // we don't want to force a download of the full membership list of this room, but as soon as we have that
        // list we can start tracking the device list.
        if (room.membersLoaded()) {
            await this.trackRoomDevicesImpl(room);
        } else {
            // wait for the membership list to be loaded
            const onState = (_state: RoomState): void => {
                room.off(RoomStateEvent.Update, onState);
                if (room.membersLoaded()) {
                    this.trackRoomDevicesImpl(room).catch((e) => {
                        logger.error(`Error enabling device tracking in ${roomId}`, e);
                    });
                }
            };
            room.on(RoomStateEvent.Update, onState);
        }
    }

    /**
     * Make sure we are tracking the device lists for all users in this room.
     *
     * @param roomId - The room ID to start tracking devices in.
     * @returns when all devices for the room have been fetched and marked to track
     * @deprecated there's normally no need to call this function: device list tracking
     *    will be enabled as soon as we have the full membership list.
     */
    public trackRoomDevices(roomId: string): Promise<void> {
        const room = this.clientStore.getRoom(roomId);
        if (!room) {
            throw new Error(`Unable to start tracking devices in unknown room ${roomId}`);
        }
        return this.trackRoomDevicesImpl(room);
    }

    /**
     * Make sure we are tracking the device lists for all users in this room.
     *
     * This is normally called when we are about to send an encrypted event, to make sure
     * we have all the devices in the room; but it is also called when processing an
     * m.room.encryption state event (if lazy-loading is disabled), or when members are
     * loaded (if lazy-loading is enabled), to prepare the device list.
     *
     * @param room - Room to enable device-list tracking in
     */
    private trackRoomDevicesImpl(room: Room): Promise<void> {
        const roomId = room.roomId;
        const trackMembers = async (): Promise<void> => {
            // not an encrypted room
            if (!this.roomEncryptors.has(roomId)) {
                return;
            }
            logger.log(`Starting to track devices for room ${roomId} ...`);
            const members = await room.getEncryptionTargetMembers();
            members.forEach((m) => {
                this.deviceList.startTrackingDeviceList(m.userId);
            });
        };

        let promise = this.roomDeviceTrackingState[roomId];
        if (!promise) {
            promise = trackMembers();
            this.roomDeviceTrackingState[roomId] = promise.catch((err) => {
                delete this.roomDeviceTrackingState[roomId];
                throw err;
            });
        }
        return promise;
    }

    /**
     * Try to make sure we have established olm sessions for all known devices for
     * the given users.
     *
     * @param users - list of user ids
     * @param force - If true, force a new Olm session to be created. Default false.
     *
     * @returns resolves once the sessions are complete, to
     *    an Object mapping from userId to deviceId to
     *    `IOlmSessionResult`
     */
    public ensureOlmSessionsForUsers(
        users: string[],
        force?: boolean,
    ): Promise<Map<string, Map<string, olmlib.IOlmSessionResult>>> {
        // map user Id → DeviceInfo[]
        const devicesByUser: Map<string, DeviceInfo[]> = new Map();

        for (const userId of users) {
            const userDevices: DeviceInfo[] = [];
            devicesByUser.set(userId, userDevices);

            const devices = this.getStoredDevicesForUser(userId) || [];
            for (const deviceInfo of devices) {
                const key = deviceInfo.getIdentityKey();
                if (key == this.olmDevice.deviceCurve25519Key) {
                    // don't bother setting up session to ourself
                    continue;
                }
                if (deviceInfo.verified == DeviceVerification.BLOCKED) {
                    // don't bother setting up sessions with blocked users
                    continue;
                }

                userDevices.push(deviceInfo);
            }
        }

        return olmlib.ensureOlmSessionsForDevices(this.olmDevice, this.baseApis, devicesByUser, force);
    }

    /**
     * Get a list containing all of the room keys
     *
     * @returns a list of session export objects
     */
    public async exportRoomKeys(): Promise<IMegolmSessionData[]> {
        const exportedSessions: IMegolmSessionData[] = [];
        await this.cryptoStore.doTxn("readonly", [IndexedDBCryptoStore.STORE_INBOUND_GROUP_SESSIONS], (txn) => {
            this.cryptoStore.getAllEndToEndInboundGroupSessions(txn, (s) => {
                if (s === null) return;

                const sess = this.olmDevice.exportInboundGroupSession(s.senderKey, s.sessionId, s.sessionData!);
                delete sess.first_known_index;
                sess.algorithm = olmlib.MEGOLM_ALGORITHM;
                exportedSessions.push(sess);
            });
        });

        return exportedSessions;
    }

    /**
     * Import a list of room keys previously exported by exportRoomKeys
     *
     * @param keys - a list of session export objects
     * @returns a promise which resolves once the keys have been imported
     */
    public importRoomKeys(keys: IMegolmSessionData[], opts: ImportRoomKeysOpts = {}): Promise<void> {
        let successes = 0;
        let failures = 0;
        const total = keys.length;

        function updateProgress(): void {
            opts.progressCallback?.({
                stage: "load_keys",
                successes,
                failures,
                total,
            });
        }

        return Promise.all(
            keys.map((key) => {
                if (!key.room_id || !key.algorithm) {
                    logger.warn("ignoring room key entry with missing fields", key);
                    failures++;
                    if (opts.progressCallback) {
                        updateProgress();
                    }
                    return null;
                }

                const alg = this.getRoomDecryptor(key.room_id, key.algorithm);
                return alg.importRoomKey(key, opts).finally(() => {
                    successes++;
                    if (opts.progressCallback) {
                        updateProgress();
                    }
                });
            }),
        ).then();
    }

    /**
     * Counts the number of end to end session keys that are waiting to be backed up
     * @returns Promise which resolves to the number of sessions requiring backup
     */
    public countSessionsNeedingBackup(): Promise<number> {
        return this.backupManager.countSessionsNeedingBackup();
    }

    /**
     * Perform any background tasks that can be done before a message is ready to
     * send, in order to speed up sending of the message.
     *
     * @param room - the room the event is in
     */
    public prepareToEncrypt(room: Room): void {
        const alg = this.roomEncryptors.get(room.roomId);
        if (alg) {
            alg.prepareToEncrypt(room);
        }
    }

    /**
     * Encrypt an event according to the configuration of the room.
     *
     * @param event -  event to be sent
     *
     * @param room - destination room.
     *
     * @returns Promise which resolves when the event has been
     *     encrypted, or null if nothing was needed
     */
    public async encryptEvent(event: MatrixEvent, room: Room): Promise<void> {
        const roomId = event.getRoomId()!;

        const alg = this.roomEncryptors.get(roomId);
        if (!alg) {
            // MatrixClient has already checked that this room should be encrypted,
            // so this is an unexpected situation.
            throw new Error(
                "Room " +
                    roomId +
                    " was previously configured to use encryption, but is " +
                    "no longer. Perhaps the homeserver is hiding the " +
                    "configuration event.",
            );
        }

        // wait for all the room devices to be loaded
        await this.trackRoomDevicesImpl(room);

        let content = event.getContent();
        // If event has an m.relates_to then we need
        // to put this on the wrapping event instead
        const mRelatesTo = content["m.relates_to"];
        if (mRelatesTo) {
            // Clone content here so we don't remove `m.relates_to` from the local-echo
            content = Object.assign({}, content);
            delete content["m.relates_to"];
        }

        // Treat element's performance metrics the same as `m.relates_to` (when present)
        const elementPerfMetrics = content["io.element.performance_metrics"];
        if (elementPerfMetrics) {
            content = Object.assign({}, content);
            delete content["io.element.performance_metrics"];
        }

        const encryptedContent = (await alg.encryptMessage(room, event.getType(), content)) as IContent;

        if (mRelatesTo) {
            encryptedContent["m.relates_to"] = mRelatesTo;
        }
        if (elementPerfMetrics) {
            encryptedContent["io.element.performance_metrics"] = elementPerfMetrics;
        }

        event.makeEncrypted(
            "m.room.encrypted",
            encryptedContent,
            this.olmDevice.deviceCurve25519Key!,
            this.olmDevice.deviceEd25519Key!,
        );
    }

    /**
     * Decrypt a received event
     *
     *
     * @returns resolves once we have
     *  finished decrypting. Rejects with an `algorithms.DecryptionError` if there
     *  is a problem decrypting the event.
     */
    public async decryptEvent(event: MatrixEvent): Promise<IEventDecryptionResult> {
        if (event.isRedacted()) {
            // Try to decrypt the redaction event, to support encrypted
            // redaction reasons.  If we can't decrypt, just fall back to using
            // the original redacted_because.
            const redactionEvent = new MatrixEvent({
                room_id: event.getRoomId(),
                ...event.getUnsigned().redacted_because,
            });
            let redactedBecause: IEvent = event.getUnsigned().redacted_because!;
            if (redactionEvent.isEncrypted()) {
                try {
                    const decryptedEvent = await this.decryptEvent(redactionEvent);
                    redactedBecause = decryptedEvent.clearEvent as IEvent;
                } catch (e) {
                    logger.warn("Decryption of redaction failed. Falling back to unencrypted event.", e);
                }
            }

            return {
                clearEvent: {
                    room_id: event.getRoomId(),
                    type: "m.room.message",
                    content: {},
                    unsigned: {
                        redacted_because: redactedBecause,
                    },
                },
            };
        } else {
            const content = event.getWireContent();
            const alg = this.getRoomDecryptor(event.getRoomId()!, content.algorithm);
            return alg.decryptEvent(event);
        }
    }

    /**
     * Handle the notification from /sync that device lists have
     * been changed.
     *
     * @param deviceLists - device_lists field from /sync
     */
    public async processDeviceLists(deviceLists: IDeviceLists): Promise<void> {
        // Here, we're relying on the fact that we only ever save the sync data after
        // sucessfully saving the device list data, so we're guaranteed that the device
        // list store is at least as fresh as the sync token from the sync store, ie.
        // any device changes received in sync tokens prior to the 'next' token here
        // have been processed and are reflected in the current device list.
        // If we didn't make this assumption, we'd have to use the /keys/changes API
        // to get key changes between the sync token in the device list and the 'old'
        // sync token used here to make sure we didn't miss any.
        await this.evalDeviceListChanges(deviceLists);
    }

    /**
     * Send a request for some room keys, if we have not already done so
     *
     * @param resend - whether to resend the key request if there is
     *    already one
     *
     * @returns a promise that resolves when the key request is queued
     */
    public requestRoomKey(
        requestBody: IRoomKeyRequestBody,
        recipients: IRoomKeyRequestRecipient[],
        resend = false,
    ): Promise<void> {
        return this.outgoingRoomKeyRequestManager
            .queueRoomKeyRequest(requestBody, recipients, resend)
            .then(() => {
                if (this.sendKeyRequestsImmediately) {
                    this.outgoingRoomKeyRequestManager.sendQueuedRequests();
                }
            })
            .catch((e) => {
                // this normally means we couldn't talk to the store
                logger.error("Error requesting key for event", e);
            });
    }

    /**
     * Cancel any earlier room key request
     *
     * @param requestBody - parameters to match for cancellation
     */
    public cancelRoomKeyRequest(requestBody: IRoomKeyRequestBody): void {
        this.outgoingRoomKeyRequestManager.cancelRoomKeyRequest(requestBody).catch((e) => {
            logger.warn("Error clearing pending room key requests", e);
        });
    }

    /**
     * Re-send any outgoing key requests, eg after verification
     * @returns
     */
    public async cancelAndResendAllOutgoingKeyRequests(): Promise<void> {
        await this.outgoingRoomKeyRequestManager.cancelAndResendAllOutgoingRequests();
    }

    /**
     * handle an m.room.encryption event
     *
     * @param room - in which the event was received
     * @param event - encryption event to be processed
     */
    public async onCryptoEvent(room: Room, event: MatrixEvent): Promise<void> {
        const content = event.getContent<IRoomEncryption>();
        await this.setRoomEncryptionImpl(room, content);
    }

    /**
     * Called before the result of a sync is processed
     *
     * @param syncData -  the data from the 'MatrixClient.sync' event
     */
    public async onSyncWillProcess(syncData: ISyncStateData): Promise<void> {
        if (!syncData.oldSyncToken) {
            // If there is no old sync token, we start all our tracking from
            // scratch, so mark everything as untracked. onCryptoEvent will
            // be called for all e2e rooms during the processing of the sync,
            // at which point we'll start tracking all the users of that room.
            logger.log("Initial sync performed - resetting device tracking state");
            this.deviceList.stopTrackingAllDeviceLists();
            // we always track our own device list (for key backups etc)
            this.deviceList.startTrackingDeviceList(this.userId);
            this.roomDeviceTrackingState = {};
        }

        this.sendKeyRequestsImmediately = false;
    }

    /**
     * handle the completion of a /sync
     *
     * This is called after the processing of each successful /sync response.
     * It is an opportunity to do a batch process on the information received.
     *
     * @param syncData -  the data from the 'MatrixClient.sync' event
     */
    public async onSyncCompleted(syncData: OnSyncCompletedData): Promise<void> {
        this.deviceList.setSyncToken(syncData.nextSyncToken ?? null);
        this.deviceList.saveIfDirty();

        // we always track our own device list (for key backups etc)
        this.deviceList.startTrackingDeviceList(this.userId);

        this.deviceList.refreshOutdatedDeviceLists();

        // we don't start uploading one-time keys until we've caught up with
        // to-device messages, to help us avoid throwing away one-time-keys that we
        // are about to receive messages for
        // (https://github.com/vector-im/element-web/issues/2782).
        if (!syncData.catchingUp) {
            this.maybeUploadOneTimeKeys();
            this.processReceivedRoomKeyRequests();

            // likewise don't start requesting keys until we've caught up
            // on to_device messages, otherwise we'll request keys that we're
            // just about to get.
            this.outgoingRoomKeyRequestManager.sendQueuedRequests();

            // Sync has finished so send key requests straight away.
            this.sendKeyRequestsImmediately = true;
        }
    }

    /**
     * Trigger the appropriate invalidations and removes for a given
     * device list
     *
     * @param deviceLists - device_lists field from /sync, or response from
     * /keys/changes
     */
    private async evalDeviceListChanges(deviceLists: Required<ISyncResponse>["device_lists"]): Promise<void> {
        if (Array.isArray(deviceLists?.changed)) {
            deviceLists.changed.forEach((u) => {
                this.deviceList.invalidateUserDeviceList(u);
            });
        }

        if (Array.isArray(deviceLists?.left) && deviceLists.left.length) {
            // Check we really don't share any rooms with these users
            // any more: the server isn't required to give us the
            // exact correct set.
            const e2eUserIds = new Set(await this.getTrackedE2eUsers());

            deviceLists.left.forEach((u) => {
                if (!e2eUserIds.has(u)) {
                    this.deviceList.stopTrackingDeviceList(u);
                }
            });
        }
    }

    /**
     * Get a list of all the IDs of users we share an e2e room with
     * for which we are tracking devices already
     *
     * @returns List of user IDs
     */
    private async getTrackedE2eUsers(): Promise<string[]> {
        const e2eUserIds: string[] = [];
        for (const room of this.getTrackedE2eRooms()) {
            const members = await room.getEncryptionTargetMembers();
            for (const member of members) {
                e2eUserIds.push(member.userId);
            }
        }
        return e2eUserIds;
    }

    /**
     * Get a list of the e2e-enabled rooms we are members of,
     * and for which we are already tracking the devices
     *
     * @returns
     */
    private getTrackedE2eRooms(): Room[] {
        return this.clientStore.getRooms().filter((room) => {
            // check for rooms with encryption enabled
            const alg = this.roomEncryptors.get(room.roomId);
            if (!alg) {
                return false;
            }
            if (!this.roomDeviceTrackingState[room.roomId]) {
                return false;
            }

            // ignore any rooms which we have left
            const myMembership = room.getMyMembership();
            return myMembership === "join" || myMembership === "invite";
        });
    }

    /**
     * Encrypts and sends a given object via Olm to-device messages to a given
     * set of devices.
     * @param userDeviceInfoArr - the devices to send to
     * @param payload - fields to include in the encrypted payload
     * @returns Promise which
     *     resolves once the message has been encrypted and sent to the given
     *     userDeviceMap, and returns the `{ contentMap, deviceInfoByDeviceId }`
     *     of the successfully sent messages.
     */
    public async encryptAndSendToDevices(userDeviceInfoArr: IOlmDevice<DeviceInfo>[], payload: object): Promise<void> {
        const toDeviceBatch: ToDeviceBatch = {
            eventType: EventType.RoomMessageEncrypted,
            batch: [],
        };

        try {
            await Promise.all(
                userDeviceInfoArr.map(async ({ userId, deviceInfo }) => {
                    const deviceId = deviceInfo.deviceId;
                    const encryptedContent: IEncryptedContent = {
                        algorithm: olmlib.OLM_ALGORITHM,
                        sender_key: this.olmDevice.deviceCurve25519Key!,
                        ciphertext: {},
                        [ToDeviceMessageId]: uuidv4(),
                    };

                    toDeviceBatch.batch.push({
                        userId,
                        deviceId,
                        payload: encryptedContent,
                    });

                    await olmlib.ensureOlmSessionsForDevices(
                        this.olmDevice,
                        this.baseApis,
                        new Map([[userId, [deviceInfo]]]),
                    );
                    await olmlib.encryptMessageForDevice(
                        encryptedContent.ciphertext,
                        this.userId,
                        this.deviceId,
                        this.olmDevice,
                        userId,
                        deviceInfo,
                        payload,
                    );
                }),
            );

            // prune out any devices that encryptMessageForDevice could not encrypt for,
            // in which case it will have just not added anything to the ciphertext object.
            // There's no point sending messages to devices if we couldn't encrypt to them,
            // since that's effectively a blank message.
            toDeviceBatch.batch = toDeviceBatch.batch.filter((msg) => {
                if (Object.keys(msg.payload.ciphertext).length > 0) {
                    return true;
                } else {
                    logger.log(`No ciphertext for device ${msg.userId}:${msg.deviceId}: pruning`);
                    return false;
                }
            });

            try {
                await this.baseApis.queueToDevice(toDeviceBatch);
            } catch (e) {
                logger.error("sendToDevice failed", e);
                throw e;
            }
        } catch (e) {
            logger.error("encryptAndSendToDevices promises failed", e);
            throw e;
        }
    }

    private onMembership = (event: MatrixEvent, member: RoomMember, oldMembership?: string): void => {
        try {
            this.onRoomMembership(event, member, oldMembership);
        } catch (e) {
            logger.error("Error handling membership change:", e);
        }
    };

    public async preprocessToDeviceMessages(events: IToDeviceEvent[]): Promise<IToDeviceEvent[]> {
        // all we do here is filter out encrypted to-device messages with the wrong algorithm. Decryption
        // happens later in decryptEvent, via the EventMapper
        return events.filter((toDevice) => {
            if (
                toDevice.type === EventType.RoomMessageEncrypted &&
                !["m.olm.v1.curve25519-aes-sha2"].includes(toDevice.content?.algorithm)
            ) {
                logger.log("Ignoring invalid encrypted to-device event from " + toDevice.sender);
                return false;
            }
            return true;
        });
    }

    /**
     * Stores the current one_time_key count which will be handled later (in a call of
     * onSyncCompleted).
     *
     * @param currentCount - The current count of one_time_keys to be stored
     */
    private updateOneTimeKeyCount(currentCount: number): void {
        if (isFinite(currentCount)) {
            this.oneTimeKeyCount = currentCount;
        } else {
            throw new TypeError("Parameter for updateOneTimeKeyCount has to be a number");
        }
    }

    public processKeyCounts(oneTimeKeysCounts?: Record<string, number>, unusedFallbackKeys?: string[]): Promise<void> {
        if (oneTimeKeysCounts !== undefined) {
            this.updateOneTimeKeyCount(oneTimeKeysCounts["signed_curve25519"] || 0);
        }

        if (unusedFallbackKeys !== undefined) {
            // If `unusedFallbackKeys` is defined, that means `device_unused_fallback_key_types`
            // is present in the sync response, which indicates that the server supports fallback keys.
            //
            // If there's no unused signed_curve25519 fallback key, we need a new one.
            this.needsNewFallback = !unusedFallbackKeys.includes("signed_curve25519");
        }

        return Promise.resolve();
    }

    private onToDeviceEvent = (event: MatrixEvent): void => {
        try {
            logger.log(
                `received to-device ${event.getType()} from: ` +
                    `${event.getSender()} id: ${event.getContent()[ToDeviceMessageId]}`,
            );

            if (event.getType() == "m.room_key" || event.getType() == "m.forwarded_room_key") {
                this.onRoomKeyEvent(event);
            } else if (event.getType() == "m.room_key_request") {
                this.onRoomKeyRequestEvent(event);
            } else if (event.getType() === "m.secret.request") {
                this.secretStorage.onRequestReceived(event);
            } else if (event.getType() === "m.secret.send") {
                this.secretStorage.onSecretReceived(event);
            } else if (event.getType() === "m.room_key.withheld") {
                this.onRoomKeyWithheldEvent(event);
            } else if (event.getContent().transaction_id) {
                this.onKeyVerificationMessage(event);
            } else if (event.getContent().msgtype === "m.bad.encrypted") {
                this.onToDeviceBadEncrypted(event);
            } else if (event.isBeingDecrypted() || event.shouldAttemptDecryption()) {
                if (!event.isBeingDecrypted()) {
                    event.attemptDecryption(this);
                }
                // once the event has been decrypted, try again
                event.once(MatrixEventEvent.Decrypted, (ev) => {
                    this.onToDeviceEvent(ev);
                });
            }
        } catch (e) {
            logger.error("Error handling toDeviceEvent:", e);
        }
    };

    /**
     * Handle a key event
     *
     * @internal
     * @param event - key event
     */
    private onRoomKeyEvent(event: MatrixEvent): void {
        const content = event.getContent();

        if (!content.room_id || !content.algorithm) {
            logger.error("key event is missing fields");
            return;
        }

        if (!this.backupManager.checkedForBackup) {
            // don't bother awaiting on this - the important thing is that we retry if we
            // haven't managed to check before
            this.backupManager.checkAndStart();
        }

        const alg = this.getRoomDecryptor(content.room_id, content.algorithm);
        alg.onRoomKeyEvent(event);
    }

    /**
     * Handle a key withheld event
     *
     * @internal
     * @param event - key withheld event
     */
    private onRoomKeyWithheldEvent(event: MatrixEvent): void {
        const content = event.getContent();

        if (
            (content.code !== "m.no_olm" && (!content.room_id || !content.session_id)) ||
            !content.algorithm ||
            !content.sender_key
        ) {
            logger.error("key withheld event is missing fields");
            return;
        }

        logger.info(
            `Got room key withheld event from ${event.getSender()} ` +
                `for ${content.algorithm} session ${content.sender_key}|${content.session_id} ` +
                `in room ${content.room_id} with code ${content.code} (${content.reason})`,
        );

        const alg = this.getRoomDecryptor(content.room_id, content.algorithm);
        if (alg.onRoomKeyWithheldEvent) {
            alg.onRoomKeyWithheldEvent(event);
        }
        if (!content.room_id) {
            // retry decryption for all events sent by the sender_key.  This will
            // update the events to show a message indicating that the olm session was
            // wedged.
            const roomDecryptors = this.getRoomDecryptors(content.algorithm);
            for (const decryptor of roomDecryptors) {
                decryptor.retryDecryptionFromSender(content.sender_key);
            }
        }
    }

    /**
     * Handle a general key verification event.
     *
     * @internal
     * @param event - verification start event
     */
    private onKeyVerificationMessage(event: MatrixEvent): void {
        if (!ToDeviceChannel.validateEvent(event, this.baseApis)) {
            return;
        }
        const createRequest = (event: MatrixEvent): VerificationRequest | undefined => {
            if (!ToDeviceChannel.canCreateRequest(ToDeviceChannel.getEventType(event))) {
                return;
            }
            const content = event.getContent();
            const deviceId = content && content.from_device;
            if (!deviceId) {
                return;
            }
            const userId = event.getSender()!;
            const channel = new ToDeviceChannel(this.baseApis, userId, [deviceId]);
            return new VerificationRequest(channel, this.verificationMethods, this.baseApis);
        };
        this.handleVerificationEvent(event, this.toDeviceVerificationRequests, createRequest);
    }

    /**
     * Handle key verification requests sent as timeline events
     *
     * @internal
     * @param event - the timeline event
     * @param room - not used
     * @param atStart - not used
     * @param removed - not used
     * @param whether - this is a live event
     */
    private onTimelineEvent = (
        event: MatrixEvent,
        room: Room,
        atStart: boolean,
        removed: boolean,
        { liveEvent = true } = {},
    ): void => {
        if (!InRoomChannel.validateEvent(event, this.baseApis)) {
            return;
        }
        const createRequest = (event: MatrixEvent): VerificationRequest => {
            const channel = new InRoomChannel(this.baseApis, event.getRoomId()!);
            return new VerificationRequest(channel, this.verificationMethods, this.baseApis);
        };
        this.handleVerificationEvent(event, this.inRoomVerificationRequests, createRequest, liveEvent);
    };

    private async handleVerificationEvent(
        event: MatrixEvent,
        requestsMap: IRequestsMap,
        createRequest: (event: MatrixEvent) => VerificationRequest | undefined,
        isLiveEvent = true,
    ): Promise<void> {
        // Wait for event to get its final ID with pendingEventOrdering: "chronological", since DM channels depend on it.
        if (event.isSending() && event.status != EventStatus.SENT) {
            let eventIdListener: () => void;
            let statusListener: () => void;
            try {
                await new Promise<void>((resolve, reject) => {
                    eventIdListener = resolve;
                    statusListener = (): void => {
                        if (event.status == EventStatus.CANCELLED) {
                            reject(new Error("Event status set to CANCELLED."));
                        }
                    };
                    event.once(MatrixEventEvent.LocalEventIdReplaced, eventIdListener);
                    event.on(MatrixEventEvent.Status, statusListener);
                });
            } catch (err) {
                logger.error("error while waiting for the verification event to be sent: ", err);
                return;
            } finally {
                event.removeListener(MatrixEventEvent.LocalEventIdReplaced, eventIdListener!);
                event.removeListener(MatrixEventEvent.Status, statusListener!);
            }
        }
        let request: VerificationRequest | undefined = requestsMap.getRequest(event);
        let isNewRequest = false;
        if (!request) {
            request = createRequest(event);
            // a request could not be made from this event, so ignore event
            if (!request) {
                logger.log(
                    `Crypto: could not find VerificationRequest for ` +
                        `${event.getType()}, and could not create one, so ignoring.`,
                );
                return;
            }
            isNewRequest = true;
            requestsMap.setRequest(event, request);
        }
        event.setVerificationRequest(request);
        try {
            await request.channel.handleEvent(event, request, isLiveEvent);
        } catch (err) {
            logger.error("error while handling verification event", err);
        }
        const shouldEmit =
            isNewRequest &&
            !request.initiatedByMe &&
            !request.invalid && // check it has enough events to pass the UNSENT stage
            !request.observeOnly;
        if (shouldEmit) {
            this.baseApis.emit(CryptoEvent.VerificationRequest, request);
        }
    }

    /**
     * Handle a toDevice event that couldn't be decrypted
     *
     * @internal
     * @param event - undecryptable event
     */
    private async onToDeviceBadEncrypted(event: MatrixEvent): Promise<void> {
        const content = event.getWireContent();
        const sender = event.getSender();
        const algorithm = content.algorithm;
        const deviceKey = content.sender_key;

        this.baseApis.emit(ClientEvent.UndecryptableToDeviceEvent, event);

        // retry decryption for all events sent by the sender_key.  This will
        // update the events to show a message indicating that the olm session was
        // wedged.
        const retryDecryption = (): void => {
            const roomDecryptors = this.getRoomDecryptors(olmlib.MEGOLM_ALGORITHM);
            for (const decryptor of roomDecryptors) {
                decryptor.retryDecryptionFromSender(deviceKey);
            }
        };

        if (sender === undefined || deviceKey === undefined || deviceKey === undefined) {
            return;
        }

        // check when we last forced a new session with this device: if we've already done so
        // recently, don't do it again.
        const lastNewSessionDevices = this.lastNewSessionForced.getOrCreate(sender);
        const lastNewSessionForced = lastNewSessionDevices.getOrCreate(deviceKey);
        if (lastNewSessionForced + MIN_FORCE_SESSION_INTERVAL_MS > Date.now()) {
            logger.debug(
                "New session already forced with device " +
                    sender +
                    ":" +
                    deviceKey +
                    " at " +
                    lastNewSessionForced +
                    ": not forcing another",
            );
            await this.olmDevice.recordSessionProblem(deviceKey, "wedged", true);
            retryDecryption();
            return;
        }

        // establish a new olm session with this device since we're failing to decrypt messages
        // on a current session.
        // Note that an undecryptable message from another device could easily be spoofed -
        // is there anything we can do to mitigate this?
        let device = this.deviceList.getDeviceByIdentityKey(algorithm, deviceKey);
        if (!device) {
            // if we don't know about the device, fetch the user's devices again
            // and retry before giving up
            await this.downloadKeys([sender], false);
            device = this.deviceList.getDeviceByIdentityKey(algorithm, deviceKey);
            if (!device) {
                logger.info("Couldn't find device for identity key " + deviceKey + ": not re-establishing session");
                await this.olmDevice.recordSessionProblem(deviceKey, "wedged", false);
                retryDecryption();
                return;
            }
        }
        const devicesByUser = new Map([[sender, [device]]]);
        await olmlib.ensureOlmSessionsForDevices(this.olmDevice, this.baseApis, devicesByUser, true);

        lastNewSessionDevices.set(deviceKey, Date.now());

        // Now send a blank message on that session so the other side knows about it.
        // (The keyshare request is sent in the clear so that won't do)
        // We send this first such that, as long as the toDevice messages arrive in the
        // same order we sent them, the other end will get this first, set up the new session,
        // then get the keyshare request and send the key over this new session (because it
        // is the session it has most recently received a message on).
        const encryptedContent: IEncryptedContent = {
            algorithm: olmlib.OLM_ALGORITHM,
            sender_key: this.olmDevice.deviceCurve25519Key!,
            ciphertext: {},
            [ToDeviceMessageId]: uuidv4(),
        };
        await olmlib.encryptMessageForDevice(
            encryptedContent.ciphertext,
            this.userId,
            this.deviceId,
            this.olmDevice,
            sender,
            device,
            { type: "m.dummy" },
        );

        await this.olmDevice.recordSessionProblem(deviceKey, "wedged", true);
        retryDecryption();

        await this.baseApis.sendToDevice(
            "m.room.encrypted",
            new Map([[sender, new Map([[device.deviceId, encryptedContent]])]]),
        );

        // Most of the time this probably won't be necessary since we'll have queued up a key request when
        // we failed to decrypt the message and will be waiting a bit for the key to arrive before sending
        // it. This won't always be the case though so we need to re-send any that have already been sent
        // to avoid races.
        const requestsToResend = await this.outgoingRoomKeyRequestManager.getOutgoingSentRoomKeyRequest(
            sender,
            device.deviceId,
        );
        for (const keyReq of requestsToResend) {
            this.requestRoomKey(keyReq.requestBody, keyReq.recipients, true);
        }
    }

    /**
     * Handle a change in the membership state of a member of a room
     *
     * @internal
     * @param event -  event causing the change
     * @param member -  user whose membership changed
     * @param oldMembership -  previous membership
     */
    private onRoomMembership(event: MatrixEvent, member: RoomMember, oldMembership?: string): void {
        // this event handler is registered on the *client* (as opposed to the room
        // member itself), which means it is only called on changes to the *live*
        // membership state (ie, it is not called when we back-paginate, nor when
        // we load the state in the initialsync).
        //
        // Further, it is automatically registered and called when new members
        // arrive in the room.

        const roomId = member.roomId;

        const alg = this.roomEncryptors.get(roomId);
        if (!alg) {
            // not encrypting in this room
            return;
        }
        // only mark users in this room as tracked if we already started tracking in this room
        // this way we don't start device queries after sync on behalf of this room which we won't use
        // the result of anyway, as we'll need to do a query again once all the members are fetched
        // by calling _trackRoomDevices
        if (roomId in this.roomDeviceTrackingState) {
            if (member.membership == "join") {
                logger.log("Join event for " + member.userId + " in " + roomId);
                // make sure we are tracking the deviceList for this user
                this.deviceList.startTrackingDeviceList(member.userId);
            } else if (
                member.membership == "invite" &&
                this.clientStore.getRoom(roomId)?.shouldEncryptForInvitedMembers()
            ) {
                logger.log("Invite event for " + member.userId + " in " + roomId);
                this.deviceList.startTrackingDeviceList(member.userId);
            }
        }

        alg.onRoomMembership(event, member, oldMembership);
    }

    /**
     * Called when we get an m.room_key_request event.
     *
     * @internal
     * @param event - key request event
     */
    private onRoomKeyRequestEvent(event: MatrixEvent): void {
        const content = event.getContent();
        if (content.action === "request") {
            // Queue it up for now, because they tend to arrive before the room state
            // events at initial sync, and we want to see if we know anything about the
            // room before passing them on to the app.
            const req = new IncomingRoomKeyRequest(event);
            this.receivedRoomKeyRequests.push(req);
        } else if (content.action === "request_cancellation") {
            const req = new IncomingRoomKeyRequestCancellation(event);
            this.receivedRoomKeyRequestCancellations.push(req);
        }
    }

    /**
     * Process any m.room_key_request events which were queued up during the
     * current sync.
     *
     * @internal
     */
    private async processReceivedRoomKeyRequests(): Promise<void> {
        if (this.processingRoomKeyRequests) {
            // we're still processing last time's requests; keep queuing new ones
            // up for now.
            return;
        }
        this.processingRoomKeyRequests = true;

        try {
            // we need to grab and clear the queues in the synchronous bit of this method,
            // so that we don't end up racing with the next /sync.
            const requests = this.receivedRoomKeyRequests;
            this.receivedRoomKeyRequests = [];
            const cancellations = this.receivedRoomKeyRequestCancellations;
            this.receivedRoomKeyRequestCancellations = [];

            // Process all of the requests, *then* all of the cancellations.
            //
            // This makes sure that if we get a request and its cancellation in the
            // same /sync result, then we process the request before the
            // cancellation (and end up with a cancelled request), rather than the
            // cancellation before the request (and end up with an outstanding
            // request which should have been cancelled.)
            await Promise.all(requests.map((req) => this.processReceivedRoomKeyRequest(req)));
            await Promise.all(
                cancellations.map((cancellation) => this.processReceivedRoomKeyRequestCancellation(cancellation)),
            );
        } catch (e) {
            logger.error(`Error processing room key requsts: ${e}`);
        } finally {
            this.processingRoomKeyRequests = false;
        }
    }

    /**
     * Helper for processReceivedRoomKeyRequests
     *
     */
    private async processReceivedRoomKeyRequest(req: IncomingRoomKeyRequest): Promise<void> {
        const userId = req.userId;
        const deviceId = req.deviceId;

        const body = req.requestBody;
        const roomId = body.room_id;
        const alg = body.algorithm;

        logger.log(
            `m.room_key_request from ${userId}:${deviceId}` +
                ` for ${roomId} / ${body.session_id} (id ${req.requestId})`,
        );

        if (userId !== this.userId) {
            if (!this.roomEncryptors.get(roomId)) {
                logger.debug(`room key request for unencrypted room ${roomId}`);
                return;
            }
            const encryptor = this.roomEncryptors.get(roomId)!;
            const device = this.deviceList.getStoredDevice(userId, deviceId);
            if (!device) {
                logger.debug(`Ignoring keyshare for unknown device ${userId}:${deviceId}`);
                return;
            }

            try {
                await encryptor.reshareKeyWithDevice!(body.sender_key, body.session_id, userId, device);
            } catch (e) {
                logger.warn(
                    "Failed to re-share keys for session " +
                        body.session_id +
                        " with device " +
                        userId +
                        ":" +
                        device.deviceId,
                    e,
                );
            }
            return;
        }

        if (deviceId === this.deviceId) {
            // We'll always get these because we send room key requests to
            // '*' (ie. 'all devices') which includes the sending device,
            // so ignore requests from ourself because apart from it being
            // very silly, it won't work because an Olm session cannot send
            // messages to itself.
            // The log here is probably superfluous since we know this will
            // always happen, but let's log anyway for now just in case it
            // causes issues.
            logger.log("Ignoring room key request from ourselves");
            return;
        }

        // todo: should we queue up requests we don't yet have keys for,
        // in case they turn up later?

        // if we don't have a decryptor for this room/alg, we don't have
        // the keys for the requested events, and can drop the requests.
        if (!this.roomDecryptors.has(roomId)) {
            logger.log(`room key request for unencrypted room ${roomId}`);
            return;
        }

        const decryptor = this.roomDecryptors.get(roomId)!.get(alg);
        if (!decryptor) {
            logger.log(`room key request for unknown alg ${alg} in room ${roomId}`);
            return;
        }

        if (!(await decryptor.hasKeysForKeyRequest(req))) {
            logger.log(`room key request for unknown session ${roomId} / ` + body.session_id);
            return;
        }

        req.share = (): void => {
            decryptor.shareKeysWithDevice(req);
        };

        // if the device is verified already, share the keys
        if (this.checkDeviceTrust(userId, deviceId).isVerified()) {
            logger.log("device is already verified: sharing keys");
            req.share();
            return;
        }

        this.emit(CryptoEvent.RoomKeyRequest, req);
    }

    /**
     * Helper for processReceivedRoomKeyRequests
     *
     */
    private async processReceivedRoomKeyRequestCancellation(
        cancellation: IncomingRoomKeyRequestCancellation,
    ): Promise<void> {
        logger.log(
            `m.room_key_request cancellation for ${cancellation.userId}:` +
                `${cancellation.deviceId} (id ${cancellation.requestId})`,
        );

        // we should probably only notify the app of cancellations we told it
        // about, but we don't currently have a record of that, so we just pass
        // everything through.
        this.emit(CryptoEvent.RoomKeyRequestCancellation, cancellation);
    }

    /**
     * Get a decryptor for a given room and algorithm.
     *
     * If we already have a decryptor for the given room and algorithm, return
     * it. Otherwise try to instantiate it.
     *
     * @internal
     *
     * @param roomId -   room id for decryptor. If undefined, a temporary
     * decryptor is instantiated.
     *
     * @param algorithm -  crypto algorithm
     *
     * @throws `DecryptionError` if the algorithm is unknown
     */
    public getRoomDecryptor(roomId: string | null, algorithm: string): DecryptionAlgorithm {
        let decryptors: Map<string, DecryptionAlgorithm> | undefined;
        let alg: DecryptionAlgorithm | undefined;

        if (roomId) {
            decryptors = this.roomDecryptors.get(roomId);
            if (!decryptors) {
                decryptors = new Map<string, DecryptionAlgorithm>();
                this.roomDecryptors.set(roomId, decryptors);
            }

            alg = decryptors.get(algorithm);
            if (alg) {
                return alg;
            }
        }

        const AlgClass = algorithms.DECRYPTION_CLASSES.get(algorithm);
        if (!AlgClass) {
            throw new algorithms.DecryptionError(
                "UNKNOWN_ENCRYPTION_ALGORITHM",
                'Unknown encryption algorithm "' + algorithm + '".',
            );
        }
        alg = new AlgClass({
            userId: this.userId,
            crypto: this,
            olmDevice: this.olmDevice,
            baseApis: this.baseApis,
            roomId: roomId ?? undefined,
        });

        if (decryptors) {
            decryptors.set(algorithm, alg);
        }
        return alg;
    }

    /**
     * Get all the room decryptors for a given encryption algorithm.
     *
     * @param algorithm - The encryption algorithm
     *
     * @returns An array of room decryptors
     */
    private getRoomDecryptors(algorithm: string): DecryptionAlgorithm[] {
        const decryptors: DecryptionAlgorithm[] = [];
        for (const d of this.roomDecryptors.values()) {
            if (d.has(algorithm)) {
                decryptors.push(d.get(algorithm)!);
            }
        }
        return decryptors;
    }

    /**
     * sign the given object with our ed25519 key
     *
     * @param obj -  Object to which we will add a 'signatures' property
     */
    public async signObject<T extends ISignableObject & object>(obj: T): Promise<void> {
        const sigs = new Map(Object.entries(obj.signatures || {}));
        const unsigned = obj.unsigned;

        delete obj.signatures;
        delete obj.unsigned;

        const userSignatures = sigs.get(this.userId) || {};
        sigs.set(this.userId, userSignatures);
        userSignatures["ed25519:" + this.deviceId] = await this.olmDevice.sign(anotherjson.stringify(obj));
        obj.signatures = recursiveMapToObject(sigs);
        if (unsigned !== undefined) obj.unsigned = unsigned;
    }
}

/**
 * Fix up the backup key, that may be in the wrong format due to a bug in a
 * migration step.  Some backup keys were stored as a comma-separated list of
 * integers, rather than a base64-encoded byte array.  If this function is
 * passed a string that looks like a list of integers rather than a base64
 * string, it will attempt to convert it to the right format.
 *
 * @param key - the key to check
 * @returns If the key is in the wrong format, then the fixed
 * key will be returned. Otherwise null will be returned.
 *
 */
export function fixBackupKey(key?: string): string | null {
    if (typeof key !== "string" || key.indexOf(",") < 0) {
        return null;
    }
    const fixedKey = Uint8Array.from(key.split(","), (x) => parseInt(x));
    return olmlib.encodeBase64(fixedKey);
}

/**
 * Represents a received m.room_key_request event
 */
export class IncomingRoomKeyRequest {
    /** user requesting the key */
    public readonly userId: string;
    /** device requesting the key */
    public readonly deviceId: string;
    /** unique id for the request */
    public readonly requestId: string;
    public readonly requestBody: IRoomKeyRequestBody;
    /**
     * callback which, when called, will ask
     *    the relevant crypto algorithm implementation to share the keys for
     *    this request.
     */
    public share: () => void;

    public constructor(event: MatrixEvent) {
        const content = event.getContent();

        this.userId = event.getSender()!;
        this.deviceId = content.requesting_device_id;
        this.requestId = content.request_id;
        this.requestBody = content.body || {};
        this.share = (): void => {
            throw new Error("don't know how to share keys for this request yet");
        };
    }
}

/**
 * Represents a received m.room_key_request cancellation
 */
class IncomingRoomKeyRequestCancellation {
    /** user requesting the cancellation */
    public readonly userId: string;
    /** device requesting the cancellation */
    public readonly deviceId: string;
    /** unique id for the request to be cancelled */
    public readonly requestId: string;

    public constructor(event: MatrixEvent) {
        const content = event.getContent();

        this.userId = event.getSender()!;
        this.deviceId = content.requesting_device_id;
        this.requestId = content.request_id;
    }
}

// a number of types are re-exported for backwards compatibility, in case any applications are referencing it.
export type { IEventDecryptionResult, IMegolmSessionData } from "../@types/crypto";

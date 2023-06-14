/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

/**
 * Classes for dealing with key backup.
 */

import type { IMegolmSessionData } from "../@types/crypto";
import { MatrixClient } from "../client";
import { logger } from "../logger";
import { MEGOLM_ALGORITHM, verifySignature } from "./olmlib";
import { DeviceInfo } from "./deviceinfo";
import { DeviceTrustLevel } from "./CrossSigning";
import { keyFromPassphrase } from "./key_passphrase";
import { safeSet, sleep } from "../utils";
import { IndexedDBCryptoStore } from "./store/indexeddb-crypto-store";
import { encodeRecoveryKey } from "./recoverykey";
import { calculateKeyCheck, decryptAES, encryptAES, IEncryptedPayload } from "./aes";
import {
    Curve25519SessionData,
    IAes256AuthData,
    ICurve25519AuthData,
    IKeyBackupInfo,
    IKeyBackupSession,
} from "./keybackup";
import { UnstableValue } from "../NamespacedValue";
import { CryptoEvent } from "./index";
import { crypto } from "./crypto";
import { HTTPError, MatrixError } from "../http-api";

const KEY_BACKUP_KEYS_PER_REQUEST = 200;
const KEY_BACKUP_CHECK_RATE_LIMIT = 5000; // ms

type AuthData = IKeyBackupInfo["auth_data"];

type SigInfo = {
    deviceId: string;
    valid?: boolean | null; // true: valid, false: invalid, null: cannot attempt validation
    device?: DeviceInfo | null;
    crossSigningId?: boolean;
    deviceTrust?: DeviceTrustLevel;
};

export type TrustInfo = {
    usable: boolean; // is the backup trusted, true iff there is a sig that is valid & from a trusted device
    sigs: SigInfo[];
    // eslint-disable-next-line camelcase
    trusted_locally?: boolean;
};

export interface IKeyBackupCheck {
    backupInfo?: IKeyBackupInfo;
    trustInfo: TrustInfo;
}

/* eslint-disable camelcase */
export interface IPreparedKeyBackupVersion {
    algorithm: string;
    auth_data: AuthData;
    recovery_key: string;
    privateKey: Uint8Array;
}
/* eslint-enable camelcase */

/** A function used to get the secret key for a backup.
 */
type GetKey = () => Promise<ArrayLike<number>>;

interface BackupAlgorithmClass {
    algorithmName: string;
    // initialize from an existing backup
    init(authData: AuthData, getKey: GetKey): Promise<BackupAlgorithm>;

    // prepare a brand new backup
    prepare(key?: string | Uint8Array | null): Promise<[Uint8Array, AuthData]>;

    checkBackupVersion(info: IKeyBackupInfo): void;
}

interface BackupAlgorithm {
    untrusted: boolean;
    encryptSession(data: Record<string, any>): Promise<Curve25519SessionData | IEncryptedPayload>;
    decryptSessions(ciphertexts: Record<string, IKeyBackupSession>): Promise<IMegolmSessionData[]>;
    authData: AuthData;
    keyMatches(key: ArrayLike<number>): Promise<boolean>;
    free(): void;
}

export interface IKeyBackup {
    rooms: {
        [roomId: string]: {
            sessions: {
                [sessionId: string]: IKeyBackupSession;
            };
        };
    };
}

/**
 * Manages the key backup.
 */
export class BackupManager {
    private algorithm: BackupAlgorithm | undefined;
    public backupInfo: IKeyBackupInfo | undefined; // The info dict from /room_keys/version
    public checkedForBackup: boolean; // Have we checked the server for a backup we can use?
    private sendingBackups: boolean; // Are we currently sending backups?
    private sessionLastCheckAttemptedTime: Record<string, number> = {}; // When did we last try to check the server for a given session id?

    public constructor(private readonly baseApis: MatrixClient, public readonly getKey: GetKey) {
        this.checkedForBackup = false;
        this.sendingBackups = false;
    }

    public get version(): string | undefined {
        return this.backupInfo && this.backupInfo.version;
    }

    /**
     * Performs a quick check to ensure that the backup info looks sane.
     *
     * Throws an error if a problem is detected.
     *
     * @param info - the key backup info
     */
    public static checkBackupVersion(info: IKeyBackupInfo): void {
        const Algorithm = algorithmsByName[info.algorithm];
        if (!Algorithm) {
            throw new Error("Unknown backup algorithm: " + info.algorithm);
        }
        if (typeof info.auth_data !== "object") {
            throw new Error("Invalid backup data returned");
        }
        return Algorithm.checkBackupVersion(info);
    }

    public static makeAlgorithm(info: IKeyBackupInfo, getKey: GetKey): Promise<BackupAlgorithm> {
        const Algorithm = algorithmsByName[info.algorithm];
        if (!Algorithm) {
            throw new Error("Unknown backup algorithm");
        }
        return Algorithm.init(info.auth_data, getKey);
    }

    public async enableKeyBackup(info: IKeyBackupInfo): Promise<void> {
        this.backupInfo = info;
        if (this.algorithm) {
            this.algorithm.free();
        }

        this.algorithm = await BackupManager.makeAlgorithm(info, this.getKey);

        this.baseApis.emit(CryptoEvent.KeyBackupStatus, true);

        // There may be keys left over from a partially completed backup, so
        // schedule a send to check.
        this.scheduleKeyBackupSend();
    }

    /**
     * Disable backing up of keys.
     */
    public disableKeyBackup(): void {
        if (this.algorithm) {
            this.algorithm.free();
        }
        this.algorithm = undefined;

        this.backupInfo = undefined;

        this.baseApis.emit(CryptoEvent.KeyBackupStatus, false);
    }

    public getKeyBackupEnabled(): boolean | null {
        if (!this.checkedForBackup) {
            return null;
        }
        return Boolean(this.algorithm);
    }

    public async prepareKeyBackupVersion(
        key?: string | Uint8Array | null,
        algorithm?: string | undefined,
    ): Promise<IPreparedKeyBackupVersion> {
        const Algorithm = algorithm ? algorithmsByName[algorithm] : DefaultAlgorithm;
        if (!Algorithm) {
            throw new Error("Unknown backup algorithm");
        }

        const [privateKey, authData] = await Algorithm.prepare(key);
        const recoveryKey = encodeRecoveryKey(privateKey)!;
        return {
            algorithm: Algorithm.algorithmName,
            auth_data: authData,
            recovery_key: recoveryKey,
            privateKey,
        };
    }

    public async createKeyBackupVersion(info: IKeyBackupInfo): Promise<void> {
        this.algorithm = await BackupManager.makeAlgorithm(info, this.getKey);
    }

    /**
     * Check the server for an active key backup and
     * if one is present and has a valid signature from
     * one of the user's verified devices, start backing up
     * to it.
     */
    public async checkAndStart(): Promise<IKeyBackupCheck | null> {
        logger.log("Checking key backup status...");
        if (this.baseApis.isGuest()) {
            logger.log("Skipping key backup check since user is guest");
            this.checkedForBackup = true;
            return null;
        }
        let backupInfo: IKeyBackupInfo | undefined;
        try {
            backupInfo = (await this.baseApis.getKeyBackupVersion()) ?? undefined;
        } catch (e) {
            logger.log("Error checking for active key backup", e);
            if ((<HTTPError>e).httpStatus === 404) {
                // 404 is returned when the key backup does not exist, so that
                // counts as successfully checking.
                this.checkedForBackup = true;
            }
            return null;
        }
        this.checkedForBackup = true;

        const trustInfo = await this.isKeyBackupTrusted(backupInfo);

        if (trustInfo.usable && !this.backupInfo) {
            logger.log(`Found usable key backup v${backupInfo!.version}: enabling key backups`);
            await this.enableKeyBackup(backupInfo!);
        } else if (!trustInfo.usable && this.backupInfo) {
            logger.log("No usable key backup: disabling key backup");
            this.disableKeyBackup();
        } else if (!trustInfo.usable && !this.backupInfo) {
            logger.log("No usable key backup: not enabling key backup");
        } else if (trustInfo.usable && this.backupInfo) {
            // may not be the same version: if not, we should switch
            if (backupInfo!.version !== this.backupInfo.version) {
                logger.log(
                    `On backup version ${this.backupInfo.version} but ` +
                        `found version ${backupInfo!.version}: switching.`,
                );
                this.disableKeyBackup();
                await this.enableKeyBackup(backupInfo!);
                // We're now using a new backup, so schedule all the keys we have to be
                // uploaded to the new backup. This is a bit of a workaround to upload
                // keys to a new backup in *most* cases, but it won't cover all cases
                // because we don't remember what backup version we uploaded keys to:
                // see https://github.com/vector-im/element-web/issues/14833
                await this.scheduleAllGroupSessionsForBackup();
            } else {
                logger.log(`Backup version ${backupInfo!.version} still current`);
            }
        }

        return { backupInfo, trustInfo };
    }

    /**
     * Forces a re-check of the key backup and enables/disables it
     * as appropriate.
     *
     * @returns Object with backup info (as returned by
     *     getKeyBackupVersion) in backupInfo and
     *     trust information (as returned by isKeyBackupTrusted)
     *     in trustInfo.
     */
    public async checkKeyBackup(): Promise<IKeyBackupCheck | null> {
        this.checkedForBackup = false;
        return this.checkAndStart();
    }

    /**
     * Attempts to retrieve a session from a key backup, if enough time
     * has elapsed since the last check for this session id.
     */
    public async queryKeyBackupRateLimited(
        targetRoomId: string | undefined,
        targetSessionId: string | undefined,
    ): Promise<void> {
        if (!this.backupInfo) {
            return;
        }

        const now = new Date().getTime();
        if (
            !this.sessionLastCheckAttemptedTime[targetSessionId!] ||
            now - this.sessionLastCheckAttemptedTime[targetSessionId!] > KEY_BACKUP_CHECK_RATE_LIMIT
        ) {
            this.sessionLastCheckAttemptedTime[targetSessionId!] = now;
            await this.baseApis.restoreKeyBackupWithCache(targetRoomId!, targetSessionId!, this.backupInfo, {});
        }
    }

    /**
     * Check if the given backup info is trusted.
     *
     * @param backupInfo - key backup info dict from /room_keys/version
     */
    public async isKeyBackupTrusted(backupInfo?: IKeyBackupInfo): Promise<TrustInfo> {
        const ret = {
            usable: false,
            trusted_locally: false,
            sigs: [] as SigInfo[],
        };

        if (!backupInfo || !backupInfo.algorithm || !backupInfo.auth_data || !backupInfo.auth_data.signatures) {
            logger.info("Key backup is absent or missing required data");
            return ret;
        }

        const userId = this.baseApis.getUserId()!;
        const privKey = await this.baseApis.crypto!.getSessionBackupPrivateKey();
        if (privKey) {
            let algorithm: BackupAlgorithm | null = null;
            try {
                algorithm = await BackupManager.makeAlgorithm(backupInfo, async () => privKey);

                if (await algorithm.keyMatches(privKey)) {
                    logger.info("Backup is trusted locally");
                    ret.trusted_locally = true;
                }
            } catch {
                // do nothing -- if we have an error, then we don't mark it as
                // locally trusted
            } finally {
                algorithm?.free();
            }
        }

        const mySigs = backupInfo.auth_data.signatures[userId] || {};

        for (const keyId of Object.keys(mySigs)) {
            const keyIdParts = keyId.split(":");
            if (keyIdParts[0] !== "ed25519") {
                logger.log("Ignoring unknown signature type: " + keyIdParts[0]);
                continue;
            }
            // Could be a cross-signing master key, but just say this is the device
            // ID for backwards compat
            const sigInfo: SigInfo = { deviceId: keyIdParts[1] };

            // first check to see if it's from our cross-signing key
            const crossSigningId = this.baseApis.crypto!.crossSigningInfo.getId();
            if (crossSigningId === sigInfo.deviceId) {
                sigInfo.crossSigningId = true;
                try {
                    await verifySignature(
                        this.baseApis.crypto!.olmDevice,
                        backupInfo.auth_data,
                        userId,
                        sigInfo.deviceId,
                        crossSigningId,
                    );
                    sigInfo.valid = true;
                } catch (e) {
                    logger.warn("Bad signature from cross signing key " + crossSigningId, e);
                    sigInfo.valid = false;
                }
                ret.sigs.push(sigInfo);
                continue;
            }

            // Now look for a sig from a device
            // At some point this can probably go away and we'll just support
            // it being signed by the cross-signing master key
            const device = this.baseApis.crypto!.deviceList.getStoredDevice(userId, sigInfo.deviceId);
            if (device) {
                sigInfo.device = device;
                sigInfo.deviceTrust = this.baseApis.checkDeviceTrust(userId, sigInfo.deviceId);
                try {
                    await verifySignature(
                        this.baseApis.crypto!.olmDevice,
                        backupInfo.auth_data,
                        userId,
                        device.deviceId,
                        device.getFingerprint(),
                    );
                    sigInfo.valid = true;
                } catch (e) {
                    logger.info(
                        "Bad signature from key ID " +
                            keyId +
                            " userID " +
                            this.baseApis.getUserId() +
                            " device ID " +
                            device.deviceId +
                            " fingerprint: " +
                            device.getFingerprint(),
                        backupInfo.auth_data,
                        e,
                    );
                    sigInfo.valid = false;
                }
            } else {
                sigInfo.valid = null; // Can't determine validity because we don't have the signing device
                logger.info("Ignoring signature from unknown key " + keyId);
            }
            ret.sigs.push(sigInfo);
        }

        ret.usable = ret.sigs.some((s) => {
            return s.valid && ((s.device && s.deviceTrust?.isVerified()) || s.crossSigningId);
        });
        return ret;
    }

    /**
     * Schedules sending all keys waiting to be sent to the backup, if not already
     * scheduled. Retries if necessary.
     *
     * @param maxDelay - Maximum delay to wait in ms. 0 means no delay.
     */
    public async scheduleKeyBackupSend(maxDelay = 10000): Promise<void> {
        if (this.sendingBackups) return;

        this.sendingBackups = true;

        try {
            // wait between 0 and `maxDelay` seconds, to avoid backup
            // requests from different clients hitting the server all at
            // the same time when a new key is sent
            const delay = Math.random() * maxDelay;
            await sleep(delay);
            let numFailures = 0; // number of consecutive failures
            for (;;) {
                if (!this.algorithm) {
                    return;
                }
                try {
                    const numBackedUp = await this.backupPendingKeys(KEY_BACKUP_KEYS_PER_REQUEST);
                    if (numBackedUp === 0) {
                        // no sessions left needing backup: we're done
                        return;
                    }
                    numFailures = 0;
                } catch (err) {
                    numFailures++;
                    logger.log("Key backup request failed", err);
                    if ((<MatrixError>err).data) {
                        if (
                            (<MatrixError>err).data.errcode == "M_NOT_FOUND" ||
                            (<MatrixError>err).data.errcode == "M_WRONG_ROOM_KEYS_VERSION"
                        ) {
                            // Re-check key backup status on error, so we can be
                            // sure to present the current situation when asked.
                            await this.checkKeyBackup();
                            // Backup version has changed or this backup version
                            // has been deleted
                            this.baseApis.crypto!.emit(CryptoEvent.KeyBackupFailed, (<MatrixError>err).data.errcode!);
                            throw err;
                        }
                    }
                }
                if (numFailures) {
                    // exponential backoff if we have failures
                    await sleep(1000 * Math.pow(2, Math.min(numFailures - 1, 4)));
                }
            }
        } finally {
            this.sendingBackups = false;
        }
    }

    /**
     * Take some e2e keys waiting to be backed up and send them
     * to the backup.
     *
     * @param limit - Maximum number of keys to back up
     * @returns Number of sessions backed up
     */
    public async backupPendingKeys(limit: number): Promise<number> {
        const sessions = await this.baseApis.crypto!.cryptoStore.getSessionsNeedingBackup(limit);
        if (!sessions.length) {
            return 0;
        }

        let remaining = await this.baseApis.crypto!.cryptoStore.countSessionsNeedingBackup();
        this.baseApis.crypto!.emit(CryptoEvent.KeyBackupSessionsRemaining, remaining);

        const rooms: IKeyBackup["rooms"] = {};
        for (const session of sessions) {
            const roomId = session.sessionData!.room_id;
            safeSet(rooms, roomId, rooms[roomId] || { sessions: {} });

            const sessionData = this.baseApis.crypto!.olmDevice.exportInboundGroupSession(
                session.senderKey,
                session.sessionId,
                session.sessionData!,
            );
            sessionData.algorithm = MEGOLM_ALGORITHM;

            const forwardedCount = (sessionData.forwarding_curve25519_key_chain || []).length;

            const userId = this.baseApis.crypto!.deviceList.getUserByIdentityKey(MEGOLM_ALGORITHM, session.senderKey);
            const device =
                this.baseApis.crypto!.deviceList.getDeviceByIdentityKey(MEGOLM_ALGORITHM, session.senderKey) ??
                undefined;
            const verified = this.baseApis.crypto!.checkDeviceInfoTrust(userId!, device).isVerified();

            safeSet(rooms[roomId]["sessions"], session.sessionId, {
                first_message_index: sessionData.first_known_index,
                forwarded_count: forwardedCount,
                is_verified: verified,
                session_data: await this.algorithm!.encryptSession(sessionData),
            });
        }

        await this.baseApis.sendKeyBackup(undefined, undefined, this.backupInfo!.version, { rooms });

        await this.baseApis.crypto!.cryptoStore.unmarkSessionsNeedingBackup(sessions);
        remaining = await this.baseApis.crypto!.cryptoStore.countSessionsNeedingBackup();
        this.baseApis.crypto!.emit(CryptoEvent.KeyBackupSessionsRemaining, remaining);

        return sessions.length;
    }

    public async backupGroupSession(senderKey: string, sessionId: string): Promise<void> {
        await this.baseApis.crypto!.cryptoStore.markSessionsNeedingBackup([
            {
                senderKey: senderKey,
                sessionId: sessionId,
            },
        ]);

        if (this.backupInfo) {
            // don't wait for this to complete: it will delay so
            // happens in the background
            this.scheduleKeyBackupSend();
        }
        // if this.backupInfo is not set, then the keys will be backed up when
        // this.enableKeyBackup is called
    }

    /**
     * Marks all group sessions as needing to be backed up and schedules them to
     * upload in the background as soon as possible.
     */
    public async scheduleAllGroupSessionsForBackup(): Promise<void> {
        await this.flagAllGroupSessionsForBackup();

        // Schedule keys to upload in the background as soon as possible.
        this.scheduleKeyBackupSend(0 /* maxDelay */);
    }

    /**
     * Marks all group sessions as needing to be backed up without scheduling
     * them to upload in the background.
     * @returns Promise which resolves to the number of sessions now requiring a backup
     *     (which will be equal to the number of sessions in the store).
     */
    public async flagAllGroupSessionsForBackup(): Promise<number> {
        await this.baseApis.crypto!.cryptoStore.doTxn(
            "readwrite",
            [IndexedDBCryptoStore.STORE_INBOUND_GROUP_SESSIONS, IndexedDBCryptoStore.STORE_BACKUP],
            (txn) => {
                this.baseApis.crypto!.cryptoStore.getAllEndToEndInboundGroupSessions(txn, (session) => {
                    if (session !== null) {
                        this.baseApis.crypto!.cryptoStore.markSessionsNeedingBackup([session], txn);
                    }
                });
            },
        );

        const remaining = await this.baseApis.crypto!.cryptoStore.countSessionsNeedingBackup();
        this.baseApis.emit(CryptoEvent.KeyBackupSessionsRemaining, remaining);
        return remaining;
    }

    /**
     * Counts the number of end to end session keys that are waiting to be backed up
     * @returns Promise which resolves to the number of sessions requiring backup
     */
    public countSessionsNeedingBackup(): Promise<number> {
        return this.baseApis.crypto!.cryptoStore.countSessionsNeedingBackup();
    }
}

export class Curve25519 implements BackupAlgorithm {
    public static algorithmName = "m.megolm_backup.v1.curve25519-aes-sha2";

    public constructor(
        public authData: ICurve25519AuthData,
        private publicKey: any, // FIXME: PkEncryption
        private getKey: () => Promise<Uint8Array>,
    ) {}

    public static async init(authData: AuthData, getKey: () => Promise<Uint8Array>): Promise<Curve25519> {
        if (!authData || !("public_key" in authData)) {
            throw new Error("auth_data missing required information");
        }
        const publicKey = new global.Olm.PkEncryption();
        publicKey.set_recipient_key(authData.public_key);
        return new Curve25519(authData as ICurve25519AuthData, publicKey, getKey);
    }

    public static async prepare(key?: string | Uint8Array | null): Promise<[Uint8Array, AuthData]> {
        const decryption = new global.Olm.PkDecryption();
        try {
            const authData: Partial<ICurve25519AuthData> = {};
            if (!key) {
                authData.public_key = decryption.generate_key();
            } else if (key instanceof Uint8Array) {
                authData.public_key = decryption.init_with_private_key(key);
            } else {
                const derivation = await keyFromPassphrase(key);
                authData.private_key_salt = derivation.salt;
                authData.private_key_iterations = derivation.iterations;
                authData.public_key = decryption.init_with_private_key(derivation.key);
            }
            const publicKey = new global.Olm.PkEncryption();
            publicKey.set_recipient_key(authData.public_key);

            return [decryption.get_private_key(), authData as AuthData];
        } finally {
            decryption.free();
        }
    }

    public static checkBackupVersion(info: IKeyBackupInfo): void {
        if (!("public_key" in info.auth_data)) {
            throw new Error("Invalid backup data returned");
        }
    }

    public get untrusted(): boolean {
        return true;
    }

    public async encryptSession(data: Record<string, any>): Promise<Curve25519SessionData> {
        const plainText: Record<string, any> = Object.assign({}, data);
        delete plainText.session_id;
        delete plainText.room_id;
        delete plainText.first_known_index;
        return this.publicKey.encrypt(JSON.stringify(plainText));
    }

    public async decryptSessions(
        sessions: Record<string, IKeyBackupSession<Curve25519SessionData>>,
    ): Promise<IMegolmSessionData[]> {
        const privKey = await this.getKey();
        const decryption = new global.Olm.PkDecryption();
        try {
            const backupPubKey = decryption.init_with_private_key(privKey);

            if (backupPubKey !== this.authData.public_key) {
                throw new MatrixError({ errcode: MatrixClient.RESTORE_BACKUP_ERROR_BAD_KEY });
            }

            const keys: IMegolmSessionData[] = [];

            for (const [sessionId, sessionData] of Object.entries(sessions)) {
                try {
                    const decrypted = JSON.parse(
                        decryption.decrypt(
                            sessionData.session_data.ephemeral,
                            sessionData.session_data.mac,
                            sessionData.session_data.ciphertext,
                        ),
                    );
                    decrypted.session_id = sessionId;
                    keys.push(decrypted);
                } catch (e) {
                    logger.log("Failed to decrypt megolm session from backup", e, sessionData);
                }
            }
            return keys;
        } finally {
            decryption.free();
        }
    }

    public async keyMatches(key: Uint8Array): Promise<boolean> {
        const decryption = new global.Olm.PkDecryption();
        let pubKey: string;
        try {
            pubKey = decryption.init_with_private_key(key);
        } finally {
            decryption.free();
        }

        return pubKey === this.authData.public_key;
    }

    public free(): void {
        this.publicKey.free();
    }
}

function randomBytes(size: number): Uint8Array {
    const buf = new Uint8Array(size);
    crypto.getRandomValues(buf);
    return buf;
}

const UNSTABLE_MSC3270_NAME = new UnstableValue(
    "m.megolm_backup.v1.aes-hmac-sha2",
    "org.matrix.msc3270.v1.aes-hmac-sha2",
);

export class Aes256 implements BackupAlgorithm {
    public static algorithmName = UNSTABLE_MSC3270_NAME.name;

    public constructor(public readonly authData: IAes256AuthData, private readonly key: Uint8Array) {}

    public static async init(authData: IAes256AuthData, getKey: () => Promise<Uint8Array>): Promise<Aes256> {
        if (!authData) {
            throw new Error("auth_data missing");
        }
        const key = await getKey();
        if (authData.mac) {
            const { mac } = await calculateKeyCheck(key, authData.iv);
            if (authData.mac.replace(/=+$/g, "") !== mac.replace(/=+/g, "")) {
                throw new Error("Key does not match");
            }
        }
        return new Aes256(authData, key);
    }

    public static async prepare(key?: string | Uint8Array | null): Promise<[Uint8Array, AuthData]> {
        let outKey: Uint8Array;
        const authData: Partial<IAes256AuthData> = {};
        if (!key) {
            outKey = randomBytes(32);
        } else if (key instanceof Uint8Array) {
            outKey = new Uint8Array(key);
        } else {
            const derivation = await keyFromPassphrase(key);
            authData.private_key_salt = derivation.salt;
            authData.private_key_iterations = derivation.iterations;
            outKey = derivation.key;
        }

        const { iv, mac } = await calculateKeyCheck(outKey);
        authData.iv = iv;
        authData.mac = mac;

        return [outKey, authData as AuthData];
    }

    public static checkBackupVersion(info: IKeyBackupInfo): void {
        if (!("iv" in info.auth_data && "mac" in info.auth_data)) {
            throw new Error("Invalid backup data returned");
        }
    }

    public get untrusted(): boolean {
        return false;
    }

    public encryptSession(data: Record<string, any>): Promise<IEncryptedPayload> {
        const plainText: Record<string, any> = Object.assign({}, data);
        delete plainText.session_id;
        delete plainText.room_id;
        delete plainText.first_known_index;
        return encryptAES(JSON.stringify(plainText), this.key, data.session_id);
    }

    public async decryptSessions(
        sessions: Record<string, IKeyBackupSession<IEncryptedPayload>>,
    ): Promise<IMegolmSessionData[]> {
        const keys: IMegolmSessionData[] = [];

        for (const [sessionId, sessionData] of Object.entries(sessions)) {
            try {
                const decrypted = JSON.parse(await decryptAES(sessionData.session_data, this.key, sessionId));
                decrypted.session_id = sessionId;
                keys.push(decrypted);
            } catch (e) {
                logger.log("Failed to decrypt megolm session from backup", e, sessionData);
            }
        }
        return keys;
    }

    public async keyMatches(key: Uint8Array): Promise<boolean> {
        if (this.authData.mac) {
            const { mac } = await calculateKeyCheck(key, this.authData.iv);
            return this.authData.mac.replace(/=+$/g, "") === mac.replace(/=+/g, "");
        } else {
            // if we have no information, we have to assume the key is right
            return true;
        }
    }

    public free(): void {
        this.key.fill(0);
    }
}

export const algorithmsByName: Record<string, BackupAlgorithmClass> = {
    [Curve25519.algorithmName]: Curve25519,
    [Aes256.algorithmName]: Aes256,
};

export const DefaultAlgorithm: BackupAlgorithmClass = Curve25519;

/*
Copyright 2025-2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type CryptoApi, CryptoEvent, type KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";
import { LogSpan, type BaseLogger, type Logger } from "matrix-js-sdk/src/logger";
import {
    type MatrixEvent,
    type MatrixClient,
    EventType,
    type SyncState,
    RoomStateEvent,
    ClientEvent,
} from "matrix-js-sdk/src/matrix";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";

import { type DeviceListener, type DeviceState } from ".";
import {
    hideToast as hideSetupEncryptionToast,
    showToast as showSetupEncryptionToast,
} from "../toasts/SetupEncryptionToast";
import { isSecretStorageBeingAccessed } from "../SecurityManager";

const KEY_BACKUP_POLL_INTERVAL = 5 * 60 * 1000;

/**
 * Account data key used to indicate that the user has chosen to enable or
 * disable server side key backups.
 */
export const ACCOUNT_DATA_KEY_M_KEY_BACKUP = "m.key_backup";
export const ACCOUNT_DATA_KEY_M_KEY_BACKUP_DISABLED_UNSTABLE = "m.org.matrix.custom.backup_disabled";

/**
 * Account data key to indicate whether the user has chosen to enable or disable recovery.
 */
export const RECOVERY_ACCOUNT_DATA_KEY = "io.element.recovery";

/**
 * We remind the user to verify their device 2 days after they dismiss the toast.
 */
const DEVICE_VERIFICATION_NAG_INTERVAL = 2 * 24 * 60 * 60 * 1000;

/**
 * Handles all of DeviceListener's work that relates to the current device.
 */
export class DeviceListenerCurrentDevice {
    /**
     * The DeviceListener launching this instance.
     */
    private deviceListener: DeviceListener;

    /**
     * The Matrix client in use by the current user.
     */
    private client: MatrixClient;

    /**
     * A Logger we use to write our debug information.
     */
    private logger: Logger;

    /**
     * Has the user dismissed any of the various nag toasts to setup encryption
     * on this device?
     */
    private dismissedThisDeviceToast = false;

    /**
     * Cache of the info about the current key backup on the server.
     */
    private keyBackupInfo: KeyBackupInfo | null = null;

    /**
     * When `keyBackupInfo` was last updated (in ms since the epoch).
     */
    private keyBackupFetchedAt: number | null = null;

    /**
     * What is the current state of the device: is its crypto OK?
     */
    private deviceState: DeviceState = "ok";

    /**
     * Was key backup upload active last time we checked?
     */
    private cachedKeyBackupUploadActive: boolean | undefined = undefined;

    public constructor(deviceListener: DeviceListener, client: MatrixClient, logger: Logger) {
        this.deviceListener = deviceListener;
        this.client = client;
        this.logger = logger;

        this.client.on(CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
        this.client.on(CryptoEvent.KeysChanged, this.onCrossSigningKeysChanged);
        this.client.on(CryptoEvent.KeyBackupStatus, this.onKeyBackupStatusChanged);
        this.client.on(CryptoEvent.KeyBackupDecryptionKeyCached, this.onKeyBackupDecryptionKeyCached);
        this.client.on(ClientEvent.AccountData, this.onAccountData);
        this.client.on(ClientEvent.Sync, this.onSync);
        this.client.on(RoomStateEvent.Events, this.onRoomStateEvents);
        this.client.on(ClientEvent.ToDeviceEvent, this.onToDeviceEvent);
    }

    /**
     * Stop listening for events and clear the stored information.
     */
    public stop(): void {
        this.dismissedThisDeviceToast = false;
        this.keyBackupInfo = null;
        this.keyBackupFetchedAt = null;
        this.cachedKeyBackupUploadActive = undefined;

        this.client.removeListener(CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
        this.client.removeListener(CryptoEvent.KeysChanged, this.onCrossSigningKeysChanged);
        this.client.removeListener(CryptoEvent.KeyBackupStatus, this.onKeyBackupStatusChanged);
        this.client.removeListener(CryptoEvent.KeyBackupDecryptionKeyCached, this.onKeyBackupDecryptionKeyCached);
        this.client.removeListener(ClientEvent.AccountData, this.onAccountData);
        this.client.removeListener(ClientEvent.Sync, this.onSync);
        this.client.removeListener(RoomStateEvent.Events, this.onRoomStateEvents);
        this.client.removeListener(ClientEvent.ToDeviceEvent, this.onToDeviceEvent);
    }

    /**
     * The user dismissed the Key Storage out of Sync toast, so we won't nag
     * them again until they refresh or restart the app.
     */
    public dismissEncryptionSetup(): void {
        // If the user dismissed the "verify this session" toast, then we will
        // re-show it later if the device still isn't verified.
        if (this.deviceState === "verify_this_session") {
            setTimeout(() => {
                if (this.deviceState === "verify_this_session") {
                    const logSpan = new LogSpan(this.logger, "nag_" + secureRandomString(4));
                    logSpan.info("Re-showing device verification toast");
                    this.dismissedThisDeviceToast = false;
                    this.setDeviceState("verify_this_session", logSpan);
                }
            }, DEVICE_VERIFICATION_NAG_INTERVAL);
        }

        this.dismissedThisDeviceToast = true;
        this.deviceListener.recheck();
    }

    /**
     * Set the account data indicate that the user has chosen to disable key
     * backup.
     */
    public async recordKeyBackupDisabled(): Promise<void> {
        await this.client.setAccountData(ACCOUNT_DATA_KEY_M_KEY_BACKUP, { enabled: false });
        await this.client.setAccountData(ACCOUNT_DATA_KEY_M_KEY_BACKUP_DISABLED_UNSTABLE, { disabled: true });
    }

    /**
     * Set the account data to indicate that recovery is disabled
     */
    public async recordRecoveryDisabled(): Promise<void> {
        await this.client.setAccountData(RECOVERY_ACCOUNT_DATA_KEY, { enabled: false });
    }

    /**
     * Display a toast if our crypto is in an unexpected state, or if we want to
     * nag the user about setting up more stuff.
     */
    public async recheck(logSpan: LogSpan): Promise<void> {
        const crypto = this.client.getCrypto();
        if (!crypto) {
            return;
        }

        let failed = await this.failIfCurrentDeviceNotTrusted(crypto, logSpan);
        if (failed) {
            return;
        }

        failed = await this.failIfCrossSigningSecretsNotCached(crypto, logSpan);
        if (failed) {
            return;
        }

        const keyBackupStatus = await this.failIfKeyBackupUploadIsFailing(logSpan);
        if (keyBackupStatus.failed) {
            return;
        }

        failed = await this.failIfRecoveryIsFailing(crypto, logSpan, keyBackupStatus);
        if (failed) {
            return;
        }

        failed = await this.failIfKeyBackupDownloadIsFailing(crypto, logSpan, keyBackupStatus);
        if (failed) {
            return;
        }

        // Everything is OK - no need to show a toast
        logSpan.info("No toast needed");
        this.setDeviceState("ok", logSpan);
    }

    /**
     * Get the state of the device and the user's account.  The device/account
     * state indicates what action the user must take in order to get a
     * self-verified device that is using key backup and recovery.
     */
    public getDeviceState(): DeviceState {
        return this.deviceState;
    }

    /**
     * If the current device is not trusted (verified via cross-signing), show a
     * toast and return true. Otherwise, return false.
     */
    private async failIfCurrentDeviceNotTrusted(crypto: CryptoApi, logSpan: LogSpan): Promise<boolean> {
        const status = await crypto.getDeviceVerificationStatus(this.client.getSafeUserId(), this.client.deviceId!);

        if (status?.crossSigningVerified) {
            return false;
        } else {
            // The current device is not trusted: prompt the user to verify
            await this.failedCheck("verify_this_session", logSpan, "info", "Current device not verified");
            return true;
        }
    }

    /**
     * If the master, device-signing and user-signing keys are not all cached
     * locally, show a toast and return true. Otherwise, return false.
     */
    private async failIfCrossSigningSecretsNotCached(crypto: CryptoApi, logSpan: LogSpan): Promise<boolean> {
        const crossSigningStatus = await crypto.getCrossSigningStatus();

        const secretsCached =
            crossSigningStatus.privateKeysCachedLocally.masterKey &&
            crossSigningStatus.privateKeysCachedLocally.selfSigningKey &&
            crossSigningStatus.privateKeysCachedLocally.userSigningKey;

        if (secretsCached) {
            return false;
        } else {
            // cross signing ready & device trusted, but we are missing secrets from our local cache.
            // prompt the user to enter their recovery key.
            const newState = crossSigningStatus.privateKeysInSecretStorage
                ? "key_storage_out_of_sync"
                : "identity_needs_reset";

            await this.failedCheck(
                newState,
                logSpan,
                "info",
                "Some secrets not cached",
                crossSigningStatus.privateKeysCachedLocally,
                crossSigningStatus.privateKeysInSecretStorage,
            );
            return true;
        }
    }

    /**
     * If the upload of the key backup is not working when it should, show a
     * toast and return true. Otherwise, return false.
     */
    private async failIfKeyBackupUploadIsFailing(logSpan: LogSpan): Promise<KeyBackupStatus> {
        const uploadActive = await this.isKeyBackupUploadActive(logSpan);
        const disabled = await this.recheckBackupDisabled();
        let failed;

        // We warn if key backup upload is turned off and we have not explicitly
        // said we are OK with that.
        const keyBackupUploadIsOk = uploadActive || disabled;

        if (!keyBackupUploadIsOk) {
            await this.failedCheck(
                "turn_on_key_storage",
                logSpan,
                "info",
                "Key backup upload is unexpectedly turned off",
            );
            failed = true;
        } else {
            failed = false;
        }

        return { uploadActive, disabled, failed };
    }

    /**
     * If the Recovery is enable but not working, show a toast and return true.
     * Otherwise, return false.
     */
    private async failIfRecoveryIsFailing(
        crypto: CryptoApi,
        logSpan: LogSpan,
        keyBackupStatus: KeyBackupStatus,
    ): Promise<boolean> {
        const secretStorageStatus = await crypto.getSecretStorageStatus();
        const recoveryDisabled = await this.recheckRecoveryDisabled(this.client);
        const recoveryIsOk = secretStorageStatus.ready || recoveryDisabled || keyBackupStatus.disabled;

        if (recoveryIsOk) {
            return false;
        } else {
            if (secretStorageStatus.defaultKeyId === null) {
                await this.failedCheck("set_up_recovery", logSpan, "info", "No default 4S key");
            } else {
                await this.failedCheck("key_storage_out_of_sync", logSpan, "warn", "4S is missing secrets", {
                    secretStorageStatus,
                });
            }
            return true;
        }
    }

    /**
     * If the download of the key backup is not working when it should, show a
     * toast and return true. Otherwise, return false.
     */
    private async failIfKeyBackupDownloadIsFailing(
        crypto: CryptoApi,
        logSpan: LogSpan,
        keyBackupStatus: KeyBackupStatus,
    ): Promise<boolean> {
        // We warn if key backup is set up, but we don't have the decryption
        // key, so can't fetch keys from backup.
        const keyBackupDownloadIsOk =
            !keyBackupStatus.uploadActive ||
            keyBackupStatus.disabled ||
            (await crypto.getSessionBackupPrivateKey()) !== null;

        if (keyBackupDownloadIsOk) {
            return false;
        } else {
            await this.failedCheck("key_storage_out_of_sync", logSpan, "warn", "Backup key is not cached locally");
            return true;
        }
    }

    /**
     * recheck failed - update our local device keys, log a message and set the
     * state to display to the user.
     */
    private async failedCheck(
        newState: DeviceState,
        logSpan: LogSpan,
        level: "info" | "warn",
        message: string,
        ...logItems: Array<any>
    ): Promise<void> {
        // Make sure our keys are finished downloading
        await this.client.getCrypto()?.getUserDeviceInfo([this.client.getSafeUserId()]);

        const fullMessage = `${message}: setting state to ${newState.toLowerCase()}`;
        if (level === "info") {
            logSpan.info(fullMessage, ...logItems);
        } else {
            logSpan.warn(fullMessage, ...logItems);
        }

        this.setDeviceState(newState, logSpan);
    }

    /**
     * Set the state of the device, and perform any actions necessary in
     * response to the state changing.
     */
    private setDeviceState(newState: DeviceState, logSpan: LogSpan): void {
        this.deviceState = newState;

        this.deviceListener.currentDeviceChangedEmitter.onStateChanged(newState);

        if (newState === "ok" || this.dismissedThisDeviceToast) {
            hideSetupEncryptionToast();
        } else if (!isSecretStorageBeingAccessed()) {
            showSetupEncryptionToast(newState);
        } else {
            // If we're in the middle of a secret storage operation, we're likely
            // modifying the state involved here, so don't add new toasts to setup.
            logSpan.info("Device is not yet ready, but secret storage is being accessed, so not showing toast.");
        }
    }

    /**
     * Fetch the account data for `m.key_backup`. If this is the first time,
     * fetch it from the server (in case the initial sync has not finished).
     * Otherwise, fetch it from the store as normal.
     *
     * Returns true if `m.key_backup` has `enabled: false`.
     */
    public async recheckBackupDisabled(): Promise<boolean> {
        const keyBackup = await this.client.getAccountDataFromServer(ACCOUNT_DATA_KEY_M_KEY_BACKUP);
        if (keyBackup) {
            return keyBackup.enabled === false;
        }

        const keyBackupDisabledUnstable = await this.client.getAccountDataFromServer(
            ACCOUNT_DATA_KEY_M_KEY_BACKUP_DISABLED_UNSTABLE,
        );
        return !!keyBackupDisabledUnstable?.disabled;
    }

    /**
     * Check whether the user has disabled recovery. If this is the first time,
     * fetch it from the server (in case the initial sync has not finished).
     * Otherwise, fetch it from the store as normal.
     */
    private async recheckRecoveryDisabled(cli: MatrixClient): Promise<boolean> {
        const recoveryStatus = await cli.getAccountDataFromServer(RECOVERY_ACCOUNT_DATA_KEY);
        // Recovery is disabled only if the `enabled` flag is set to `false`.
        // If it is missing, or set to any other value, we consider it as
        // not-disabled, and will prompt the user to create recovery (if
        // missing).
        return recoveryStatus?.enabled === false;
    }

    private onUserTrustStatusChanged = (userId: string): void => {
        if (userId !== this.client.getUserId()) return;
        this.deviceListener.recheck();
    };

    private onKeyBackupStatusChanged = (): void => {
        this.logger.info("Backup status changed");
        this.cachedKeyBackupUploadActive = undefined;
        this.deviceListener.recheck();
    };

    private onKeyBackupDecryptionKeyCached = (): void => {
        this.logger.info("Backup decryption key cached");
        this.cachedKeyBackupUploadActive = undefined;
        this.deviceListener.recheck();
    };

    private onCrossSigningKeysChanged = (): void => {
        this.deviceListener.recheck();
    };

    private onAccountData = (ev: MatrixEvent): void => {
        // User may have:
        // * migrated SSSS to symmetric
        // * uploaded keys to secret storage
        // * completed secret storage creation
        // * disabled key backup
        // which result in account data changes affecting checks below.
        if (
            ev.getType().startsWith("m.secret_storage.") ||
            ev.getType().startsWith("m.cross_signing.") ||
            ev.getType() === "m.megolm_backup.v1" ||
            ev.getType() === ACCOUNT_DATA_KEY_M_KEY_BACKUP ||
            ev.getType() === ACCOUNT_DATA_KEY_M_KEY_BACKUP_DISABLED_UNSTABLE ||
            ev.getType() === RECOVERY_ACCOUNT_DATA_KEY
        ) {
            this.deviceListener.recheck();
        }
    };

    private onSync = (state: SyncState, prevState: SyncState | null): void => {
        if (state === "PREPARED" && prevState === null) {
            this.deviceListener.recheck();
        }
    };

    private onRoomStateEvents = (ev: MatrixEvent): void => {
        if (ev.getType() !== EventType.RoomEncryption) return;

        // If a room changes to encrypted, re-check as it may be our first
        // encrypted room. This also catches encrypted room creation as well.
        this.deviceListener.recheck();
    };

    private onToDeviceEvent = (event: MatrixEvent): void => {
        // Receiving a 4S secret can mean we are in sync where we were not before.
        if (event.getType() === EventType.SecretSend) {
            this.deviceListener.recheck();
        }
    };

    /**
     * Fetch the key backup information from the server.
     *
     * The result is cached for `KEY_BACKUP_POLL_INTERVAL` ms to avoid repeated API calls.
     *
     * @returns The key backup info from the server, or `null` if there is no key backup.
     */
    public async getKeyBackupInfo(): Promise<KeyBackupInfo | null> {
        const now = new Date().getTime();
        const crypto = this.client.getCrypto();
        if (!crypto) return null;

        if (
            !this.keyBackupInfo ||
            !this.keyBackupFetchedAt ||
            this.keyBackupFetchedAt < now - KEY_BACKUP_POLL_INTERVAL
        ) {
            this.keyBackupInfo = await crypto.getKeyBackupInfo();
            this.keyBackupFetchedAt = now;
        }

        return this.keyBackupInfo;
    }

    /**
     * Is key backup enabled? Use a cached answer if we have one.
     */
    private isKeyBackupUploadActive = async (logger: BaseLogger): Promise<boolean> => {
        const crypto = this.client.getCrypto();
        if (!crypto) {
            // If there is no crypto, there is no key backup
            return false;
        }

        // If we've already cached the answer, return it.
        if (this.cachedKeyBackupUploadActive !== undefined) {
            return this.cachedKeyBackupUploadActive;
        }

        // Fetch the answer and cache it
        const activeKeyBackupVersion = await crypto.getActiveSessionBackupVersion();
        this.cachedKeyBackupUploadActive = !!activeKeyBackupVersion;
        logger.debug(`Key backup upload is ${this.cachedKeyBackupUploadActive ? "active" : "inactive"}`);

        return this.cachedKeyBackupUploadActive;
    };
}

/**
 * The current state of Key backup.
 */
interface KeyBackupStatus {
    uploadActive: boolean;
    disabled: boolean;
    failed: boolean;
}

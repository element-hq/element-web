/*
Copyright 2025-2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { CryptoEvent, type KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";
import { type LogSpan, type BaseLogger, type Logger } from "matrix-js-sdk/src/logger";
import {
    type MatrixEvent,
    type MatrixClient,
    EventType,
    type SyncState,
    RoomStateEvent,
    ClientEvent,
} from "matrix-js-sdk/src/matrix";

import type DeviceListener from "../device-listener/DeviceListener";
import type DeviceState from "./DeviceState";
import { DeviceListenerEvents } from "../device-listener/DeviceListener";
import {
    hideToast as hideSetupEncryptionToast,
    showToast as showSetupEncryptionToast,
} from "../toasts/SetupEncryptionToast";
import { isSecretStorageBeingAccessed } from "../SecurityManager";
import { asyncSomeParallel } from "../utils/arrays";

const KEY_BACKUP_POLL_INTERVAL = 5 * 60 * 1000;

/**
 * Unfortunately-named account data key used by Element X to indicate that the user
 * has chosen to disable server side key backups.
 *
 * We need to set and honour this to prevent Element X from automatically turning key backup back on.
 */
export const BACKUP_DISABLED_ACCOUNT_DATA_KEY = "m.org.matrix.custom.backup_disabled";

/**
 * Account data key to indicate whether the user has chosen to enable or disable recovery.
 */
export const RECOVERY_ACCOUNT_DATA_KEY = "io.element.recovery";

/**
 * Handles all of DeviceListener's work that relates to the current device.
 */
export default class DeviceListenerCurrentDevice {
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
        this.dismissedThisDeviceToast = true;
        this.deviceListener.recheck();
    }

    /**
     * Set the account data "m.org.matrix.custom.backup_disabled" to `{ "disabled": true }`.
     */
    public async recordKeyBackupDisabled(): Promise<void> {
        await this.client.setAccountData(BACKUP_DISABLED_ACCOUNT_DATA_KEY, { disabled: true });
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

        const crossSigningReady = await crypto.isCrossSigningReady();
        const secretStorageStatus = await crypto.getSecretStorageStatus();
        const crossSigningStatus = await crypto.getCrossSigningStatus();
        const allCrossSigningSecretsCached =
            crossSigningStatus.privateKeysCachedLocally.masterKey &&
            crossSigningStatus.privateKeysCachedLocally.selfSigningKey &&
            crossSigningStatus.privateKeysCachedLocally.userSigningKey;

        const recoveryDisabled = await this.recheckRecoveryDisabled(this.client);

        const recoveryIsOk = secretStorageStatus.ready || recoveryDisabled;

        const isCurrentDeviceTrusted = Boolean(
            (await crypto.getDeviceVerificationStatus(this.client.getSafeUserId(), this.client.deviceId!))
                ?.crossSigningVerified,
        );

        const keyBackupUploadActive = await this.isKeyBackupUploadActive(logSpan);
        const backupDisabled = await this.recheckBackupDisabled();

        // We warn if key backup upload is turned off and we have not explicitly
        // said we are OK with that.
        const keyBackupUploadIsOk = keyBackupUploadActive || backupDisabled;

        // We warn if key backup is set up, but we don't have the decryption
        // key, so can't fetch keys from backup.
        const keyBackupDownloadIsOk =
            !keyBackupUploadActive || backupDisabled || (await crypto.getSessionBackupPrivateKey()) !== null;

        const allSystemsReady =
            isCurrentDeviceTrusted &&
            allCrossSigningSecretsCached &&
            keyBackupUploadIsOk &&
            recoveryIsOk &&
            keyBackupDownloadIsOk;

        if (allSystemsReady) {
            logSpan.info("No toast needed");
            await this.setDeviceState("ok", logSpan);
        } else {
            // make sure our keys are finished downloading
            await crypto.getUserDeviceInfo([this.client.getSafeUserId()]);

            if (!isCurrentDeviceTrusted) {
                // the current device is not trusted: prompt the user to verify
                logSpan.info("Current device not verified: setting state to VERIFY_THIS_SESSION");
                await this.setDeviceState("verify_this_session", logSpan);
            } else if (!allCrossSigningSecretsCached) {
                // cross signing ready & device trusted, but we are missing secrets from our local cache.
                // prompt the user to enter their recovery key.
                logSpan.info(
                    "Some secrets not cached: setting state to KEY_STORAGE_OUT_OF_SYNC",
                    crossSigningStatus.privateKeysCachedLocally,
                    crossSigningStatus.privateKeysInSecretStorage,
                );
                await this.setDeviceState(
                    crossSigningStatus.privateKeysInSecretStorage ? "key_storage_out_of_sync" : "identity_needs_reset",
                    logSpan,
                );
            } else if (!keyBackupUploadIsOk) {
                logSpan.info("Key backup upload is unexpectedly turned off: setting state to TURN_ON_KEY_STORAGE");
                await this.setDeviceState("turn_on_key_storage", logSpan);
            } else if (secretStorageStatus.defaultKeyId === null) {
                // The user just hasn't set up 4S yet: if they have key
                // backup, prompt them to turn on recovery too. (If not, they
                // have explicitly opted out, so don't hassle them.)
                if (recoveryDisabled) {
                    logSpan.info("Recovery disabled: no toast needed");
                    await this.setDeviceState("ok", logSpan);
                } else if (keyBackupUploadActive) {
                    logSpan.info("No default 4S key: setting state to SET_UP_RECOVERY");
                    await this.setDeviceState("set_up_recovery", logSpan);
                } else {
                    logSpan.info("No default 4S key but backup disabled: no toast needed");
                    await this.setDeviceState("ok", logSpan);
                }
            } else {
                // If we get here, then we are verified, have key backup, and
                // 4S, but allSystemsReady is false, which means that either
                // secretStorageStatus.ready is false (which means that 4S
                // doesn't have all the secrets), or we don't have the backup
                // key cached locally. If any of the cross-signing keys are
                // missing locally, that is handled by the
                // `!allCrossSigningSecretsCached` branch above.
                logSpan.warn("4S is missing secrets or backup key not cached", {
                    crossSigningReady,
                    secretStorageStatus,
                    allCrossSigningSecretsCached,
                    isCurrentDeviceTrusted,
                    keyBackupDownloadIsOk,
                });
                await this.setDeviceState("key_storage_out_of_sync", logSpan);
            }
        }
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
     * Set the state of the device, and perform any actions necessary in
     * response to the state changing.
     */
    private async setDeviceState(newState: DeviceState, logSpan: LogSpan): Promise<void> {
        this.deviceState = newState;

        this.deviceListener.emit(DeviceListenerEvents.DeviceState, newState);

        if (newState === "ok" || this.dismissedThisDeviceToast) {
            hideSetupEncryptionToast();
        } else if (await this.shouldShowSetupEncryptionToast()) {
            showSetupEncryptionToast(newState);
        } else {
            logSpan.info("Not yet ready, but shouldShowSetupEncryptionToast==false");
        }
    }

    /**
     * Fetch the account data for `backup_disabled`. If this is the first time,
     * fetch it from the server (in case the initial sync has not finished).
     * Otherwise, fetch it from the store as normal.
     */
    public async recheckBackupDisabled(): Promise<boolean> {
        const backupDisabled = await this.client.getAccountDataFromServer(BACKUP_DISABLED_ACCOUNT_DATA_KEY);
        return !!backupDisabled?.disabled;
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
            ev.getType() === BACKUP_DISABLED_ACCOUNT_DATA_KEY ||
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
     * Is the user in at least one encrypted room?
     */
    private async shouldShowSetupEncryptionToast(): Promise<boolean> {
        // If we're in the middle of a secret storage operation, we're likely
        // modifying the state involved here, so don't add new toasts to setup.
        if (isSecretStorageBeingAccessed()) return false;

        // Show setup toasts once the user is in at least one encrypted room.
        const cryptoApi = this.client.getCrypto();
        if (!cryptoApi) return false;

        return await asyncSomeParallel(this.client.getRooms(), ({ roomId }) =>
            cryptoApi.isEncryptionEnabledInRoom(roomId),
        );
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

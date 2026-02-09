/*
Copyright 2025 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type MatrixEvent,
    ClientEvent,
    EventType,
    type MatrixClient,
    RoomStateEvent,
    type SyncState,
    ClientStoppedError,
    TypedEventEmitter,
} from "matrix-js-sdk/src/matrix";
import { logger as baseLogger, type BaseLogger, LogSpan } from "matrix-js-sdk/src/logger";
import { CryptoEvent, type KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";
import { type CryptoSessionStateChange } from "@matrix-org/analytics-events/types/typescript/CryptoSessionStateChange";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";

import { PosthogAnalytics } from "./PosthogAnalytics";
import dis from "./dispatcher/dispatcher";
import {
    hideToast as hideSetupEncryptionToast,
    showToast as showSetupEncryptionToast,
} from "./toasts/SetupEncryptionToast";
import { isSecretStorageBeingAccessed } from "./SecurityManager";
import { type ActionPayload } from "./dispatcher/payloads";
import { Action } from "./dispatcher/actions";
import SdkConfig from "./SdkConfig";
import PlatformPeg from "./PlatformPeg";
import { recordClientInformation, removeClientInformation } from "./utils/device/clientInformation";
import SettingsStore, { type CallbackFn } from "./settings/SettingsStore";
import { asyncSomeParallel } from "./utils/arrays.ts";
import DeviceListenerOtherDevices from "./device-listener/DeviceListenerOtherDevices.ts";

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

const logger = baseLogger.getChild("DeviceListener:");

/**
 * The state of the device and the user's account.
 */
export type DeviceState =
    /**
     * The device is in a good state.
     */
    | "ok"
    /**
     * The user needs to set up recovery.
     */
    | "set_up_recovery"
    /**
     * The device is not verified.
     */
    | "verify_this_session"
    /**
     * Key storage is out of sync (keys are missing locally, from recovery, or both).
     */
    | "key_storage_out_of_sync"
    /**
     * Key storage is not enabled, and has not been marked as purposely disabled.
     */
    | "turn_on_key_storage"
    /**
     * The user's identity needs resetting, due to missing keys.
     */
    | "identity_needs_reset";

/**
 * The events emitted by {@link DeviceListener}
 */
export enum DeviceListenerEvents {
    DeviceState = "device_state",
}

type EventHandlerMap = {
    [DeviceListenerEvents.DeviceState]: (state: DeviceState) => void;
};

export default class DeviceListener extends TypedEventEmitter<DeviceListenerEvents, EventHandlerMap> {
    private dispatcherRef?: string;

    /** All the information about whether other devices are verified. */
    public otherDevices?: DeviceListenerOtherDevices;

    // has the user dismissed any of the various nag toasts to setup encryption on this device?
    private dismissedThisDeviceToast = false;
    /** Cache of the info about the current key backup on the server. */
    private keyBackupInfo: KeyBackupInfo | null = null;
    /** When `keyBackupInfo` was last updated */
    private keyBackupFetchedAt: number | null = null;
    private running = false;
    // The client with which the instance is running. Only set if `running` is true, otherwise undefined.
    private client?: MatrixClient;
    private shouldRecordClientInformation = false;
    private deviceClientInformationSettingWatcherRef: string | undefined;
    private deviceState: DeviceState = "ok";

    // Remember the current analytics state to avoid sending the same event multiple times.
    private analyticsVerificationState?: string;
    private analyticsRecoveryState?: string;

    public static sharedInstance(): DeviceListener {
        if (!window.mxDeviceListener) window.mxDeviceListener = new DeviceListener();
        return window.mxDeviceListener;
    }

    public start(matrixClient: MatrixClient): void {
        this.running = true;

        this.otherDevices = new DeviceListenerOtherDevices(this, matrixClient);

        this.client = matrixClient;
        this.client.on(CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
        this.client.on(CryptoEvent.KeysChanged, this.onCrossSingingKeysChanged);
        this.client.on(CryptoEvent.KeyBackupStatus, this.onKeyBackupStatusChanged);
        this.client.on(ClientEvent.AccountData, this.onAccountData);
        this.client.on(ClientEvent.Sync, this.onSync);
        this.client.on(RoomStateEvent.Events, this.onRoomStateEvents);
        this.client.on(ClientEvent.ToDeviceEvent, this.onToDeviceEvent);

        this.shouldRecordClientInformation = SettingsStore.getValue("deviceClientInformationOptIn");
        // only configurable in config, so we don't need to watch the value
        this.deviceClientInformationSettingWatcherRef = SettingsStore.watchSetting(
            "deviceClientInformationOptIn",
            null,
            this.onRecordClientInformationSettingChange,
        );
        this.dispatcherRef = dis.register(this.onAction);
        this.recheck();
        this.updateClientInformation();
    }

    public stop(): void {
        this.running = false;
        if (this.client) {
            this.client.removeListener(CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
            this.client.removeListener(CryptoEvent.KeysChanged, this.onCrossSingingKeysChanged);
            this.client.removeListener(ClientEvent.AccountData, this.onAccountData);
            this.client.removeListener(ClientEvent.Sync, this.onSync);
            this.client.removeListener(RoomStateEvent.Events, this.onRoomStateEvents);
            this.client.removeListener(ClientEvent.ToDeviceEvent, this.onToDeviceEvent);
        }
        SettingsStore.unwatchSetting(this.deviceClientInformationSettingWatcherRef);
        dis.unregister(this.dispatcherRef);
        this.dispatcherRef = undefined;
        this.otherDevices?.stop();
        this.dismissedThisDeviceToast = false;
        this.keyBackupInfo = null;
        this.keyBackupFetchedAt = null;
        this.cachedKeyBackupUploadActive = undefined;
        this.client = undefined;
    }

    /**
     * Pause the device listener while a function runs.
     *
     * This can be done if the function makes several changes that would trigger
     * multiple events, to suppress warning toasts until the process is
     * finished.
     */
    public async whilePaused(fn: () => Promise<void>): Promise<void> {
        const client = this.client;
        try {
            this.stop();
            await fn();
        } finally {
            if (client) {
                this.start(client);
            }
        }
    }

    /**
     * Dismiss notifications about our own unverified devices
     *
     * @param {String[]} deviceIds List of device IDs to dismiss notifications for
     */
    public async dismissUnverifiedSessions(deviceIds: Iterable<string>): Promise<void> {
        logger.debug("Dismissing unverified sessions: " + Array.from(deviceIds).join(","));

        this.otherDevices?.dismissUnverifiedSessions(deviceIds);
    }

    public dismissEncryptionSetup(): void {
        this.dismissedThisDeviceToast = true;
        this.recheck();
    }

    /**
     * Set the account data "m.org.matrix.custom.backup_disabled" to { "disabled": true }.
     */
    public async recordKeyBackupDisabled(): Promise<void> {
        await this.client?.setAccountData(BACKUP_DISABLED_ACCOUNT_DATA_KEY, { disabled: true });
    }

    /**
     * Set the account data to indicate that recovery is disabled
     */
    public async recordRecoveryDisabled(): Promise<void> {
        await this.client?.setAccountData(RECOVERY_ACCOUNT_DATA_KEY, { enabled: false });
    }

    /**
     * If the device is in a `key_storage_out_of_sync` state, check if
     * it requires a reset of cross-signing keys.
     *
     * We will reset cross-signing keys if both our local cache and 4S don't
     * have all cross-signing keys.
     *
     * In theory, if the set of keys in our cache and in 4S are different, and
     * we have a complete set between the two, we could be OK, but that
     * should be exceptionally rare, and is more complicated to detect.
     */
    public async keyStorageOutOfSyncNeedsCrossSigningReset(forgotRecovery: boolean): Promise<boolean> {
        const crypto = this.client?.getCrypto();
        if (!crypto) {
            return false;
        }
        const crossSigningStatus = await crypto.getCrossSigningStatus();
        const allCrossSigningSecretsCached =
            crossSigningStatus.privateKeysCachedLocally.masterKey &&
            crossSigningStatus.privateKeysCachedLocally.selfSigningKey &&
            crossSigningStatus.privateKeysCachedLocally.userSigningKey;

        if (forgotRecovery) {
            return !allCrossSigningSecretsCached;
        } else {
            return !allCrossSigningSecretsCached && !crossSigningStatus.privateKeysInSecretStorage;
        }
    }

    /**
     * If the device is in a `"key_storage_out_of_sync"` state, check if
     * it requires a reset of key backup.
     *
     * If the user has their recovery key, we need to reset backup if:
     * - the user hasn't disabled backup,
     * - we don't have the backup key cached locally, *and*
     * - we don't have the backup key stored in 4S.
     * (The user should already have a key backup created at this point, the
     * device state would be `turn_on_key_storage`.)
     *
     * If the user has forgotten their recovery key, we need to reset backup if:
     * - the user hasn't disabled backup, and
     * - we don't have the backup key locally.
     */
    public async keyStorageOutOfSyncNeedsBackupReset(forgotRecovery: boolean): Promise<boolean> {
        const crypto = this.client?.getCrypto();
        if (!crypto) {
            return false;
        }
        const shouldHaveBackup = !(await this.recheckBackupDisabled(this.client!));
        const backupKeyCached = (await crypto.getSessionBackupPrivateKey()) !== null;
        const backupKeyStored = await this.client!.isKeyBackupKeyStored();

        if (forgotRecovery) {
            return shouldHaveBackup && !backupKeyCached;
        } else {
            return shouldHaveBackup && !backupKeyCached && !backupKeyStored;
        }
    }

    private onUserTrustStatusChanged = (userId: string): void => {
        if (!this.client) return;
        if (userId !== this.client.getUserId()) return;
        this.recheck();
    };

    private onKeyBackupStatusChanged = (): void => {
        logger.info("Backup status changed");
        this.cachedKeyBackupUploadActive = undefined;
        this.recheck();
    };

    private onCrossSingingKeysChanged = (): void => {
        this.recheck();
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
            this.recheck();
        }
    };

    private onSync = (state: SyncState, prevState: SyncState | null): void => {
        if (state === "PREPARED" && prevState === null) {
            this.recheck();
        }
    };

    private onRoomStateEvents = (ev: MatrixEvent): void => {
        if (ev.getType() !== EventType.RoomEncryption) return;

        // If a room changes to encrypted, re-check as it may be our first
        // encrypted room. This also catches encrypted room creation as well.
        this.recheck();
    };

    private onAction = ({ action }: ActionPayload): void => {
        if (action !== Action.OnLoggedIn) return;
        this.recheck();
        this.updateClientInformation();
    };

    private onToDeviceEvent = (event: MatrixEvent): void => {
        // Receiving a 4S secret can mean we are in sync where we were not before.
        if (event.getType() === EventType.SecretSend) this.recheck();
    };

    /**
     * Fetch the key backup information from the server.
     *
     * The result is cached for `KEY_BACKUP_POLL_INTERVAL` ms to avoid repeated API calls.
     *
     * @returns The key backup info from the server, or `null` if there is no key backup.
     */
    private async getKeyBackupInfo(): Promise<KeyBackupInfo | null> {
        if (!this.client) return null;
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

    private async shouldShowSetupEncryptionToast(): Promise<boolean> {
        // If we're in the middle of a secret storage operation, we're likely
        // modifying the state involved here, so don't add new toasts to setup.
        if (isSecretStorageBeingAccessed()) return false;
        // Show setup toasts once the user is in at least one encrypted room.
        const cli = this.client;
        const cryptoApi = cli?.getCrypto();
        if (!cli || !cryptoApi) return false;

        return await asyncSomeParallel(cli.getRooms(), ({ roomId }) => cryptoApi.isEncryptionEnabledInRoom(roomId));
    }

    public recheck(): void {
        this.doRecheck().catch((e) => {
            if (e instanceof ClientStoppedError) {
                // the client was stopped while recheck() was running. Nothing left to do.
            } else {
                logger.error("Error during `DeviceListener.recheck`", e);
            }
        });
    }

    private async doRecheck(): Promise<void> {
        if (!this.running || !this.client) return; // we have been stopped
        const logSpan = new LogSpan(logger, "check_" + secureRandomString(4));
        logSpan.debug("starting recheck...");

        const cli = this.client;

        const crypto = cli.getCrypto();
        if (!crypto) {
            logSpan.debug("crypto not enabled");
            return;
        }

        // don't recheck until the initial sync is complete: lots of account data events will fire
        // while the initial sync is processing and we don't need to recheck on each one of them
        // (we add a listener on sync to do once check after the initial sync is done)
        if (!cli.isInitialSyncComplete()) {
            logSpan.debug("initial sync not yet complete");
            return;
        }

        const crossSigningReady = await crypto.isCrossSigningReady();
        const secretStorageStatus = await crypto.getSecretStorageStatus();
        const crossSigningStatus = await crypto.getCrossSigningStatus();
        const allCrossSigningSecretsCached =
            crossSigningStatus.privateKeysCachedLocally.masterKey &&
            crossSigningStatus.privateKeysCachedLocally.selfSigningKey &&
            crossSigningStatus.privateKeysCachedLocally.userSigningKey;

        const recoveryDisabled = await this.recheckRecoveryDisabled(cli);

        const recoveryIsOk = secretStorageStatus.ready || recoveryDisabled;

        const isCurrentDeviceTrusted = Boolean(
            (await crypto.getDeviceVerificationStatus(cli.getSafeUserId(), cli.deviceId!))?.crossSigningVerified,
        );

        const keyBackupUploadActive = await this.isKeyBackupUploadActive(logSpan);
        const backupDisabled = await this.recheckBackupDisabled(cli);

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

        await this.reportCryptoSessionStateToAnalytics(cli);

        if (allSystemsReady) {
            logSpan.info("No toast needed");
            await this.setDeviceState("ok", logSpan);
        } else {
            // make sure our keys are finished downloading
            await crypto.getUserDeviceInfo([cli.getSafeUserId()]);

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

        await this.otherDevices?.recheck(logSpan);
    }

    /**
     * Fetch the account data for `backup_disabled`. If this is the first time,
     * fetch it from the server (in case the initial sync has not finished).
     * Otherwise, fetch it from the store as normal.
     */
    private async recheckBackupDisabled(cli: MatrixClient): Promise<boolean> {
        const backupDisabled = await cli.getAccountDataFromServer(BACKUP_DISABLED_ACCOUNT_DATA_KEY);
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
        this.emit(DeviceListenerEvents.DeviceState, newState);
        if (newState === "ok" || this.dismissedThisDeviceToast) {
            hideSetupEncryptionToast();
        } else if (await this.shouldShowSetupEncryptionToast()) {
            showSetupEncryptionToast(newState);
        } else {
            logSpan.info("Not yet ready, but shouldShowSetupEncryptionToast==false");
        }
    }

    /**
     * Reports current recovery state to analytics.
     * Checks if the session is verified and if the recovery is correctly set up (i.e all secrets known locally and in 4S).
     * @param cli - the matrix client
     * @private
     */
    private async reportCryptoSessionStateToAnalytics(cli: MatrixClient): Promise<void> {
        const crypto = cli.getCrypto()!;
        const secretStorageStatus = await crypto.getSecretStorageStatus();
        const secretStorageReady = secretStorageStatus.ready;
        const crossSigningStatus = await crypto.getCrossSigningStatus();
        const backupInfo = await this.getKeyBackupInfo();
        const is4SEnabled = secretStorageStatus.defaultKeyId != null;
        const deviceVerificationStatus = await crypto.getDeviceVerificationStatus(cli.getUserId()!, cli.getDeviceId()!);

        const verificationState =
            deviceVerificationStatus?.signedByOwner && deviceVerificationStatus?.crossSigningVerified
                ? "Verified"
                : "NotVerified";

        let recoveryState: "Disabled" | "Enabled" | "Incomplete";
        if (!is4SEnabled) {
            recoveryState = "Disabled";
        } else {
            const allCrossSigningSecretsCached =
                crossSigningStatus.privateKeysCachedLocally.masterKey &&
                crossSigningStatus.privateKeysCachedLocally.selfSigningKey &&
                crossSigningStatus.privateKeysCachedLocally.userSigningKey;
            if (backupInfo != null) {
                // There is a backup. Check that all secrets are stored in 4S and known locally.
                // If they are not, recovery is incomplete.
                const backupPrivateKeyIsInCache = (await crypto.getSessionBackupPrivateKey()) != null;
                if (secretStorageReady && allCrossSigningSecretsCached && backupPrivateKeyIsInCache) {
                    recoveryState = "Enabled";
                } else {
                    recoveryState = "Incomplete";
                }
            } else {
                // No backup. Just consider cross-signing secrets.
                if (secretStorageReady && allCrossSigningSecretsCached) {
                    recoveryState = "Enabled";
                } else {
                    recoveryState = "Incomplete";
                }
            }
        }

        if (this.analyticsVerificationState === verificationState && this.analyticsRecoveryState === recoveryState) {
            // No changes, no need to send the event nor update the user properties
            return;
        }
        this.analyticsRecoveryState = recoveryState;
        this.analyticsVerificationState = verificationState;

        // Update user properties
        PosthogAnalytics.instance.setProperty("recoveryState", recoveryState);
        PosthogAnalytics.instance.setProperty("verificationState", verificationState);

        PosthogAnalytics.instance.trackEvent<CryptoSessionStateChange>({
            eventName: "CryptoSessionState",
            verificationState: verificationState,
            recoveryState: recoveryState,
        });
    }

    /**
     * Is key backup enabled? Use a cached answer if we have one.
     */
    private isKeyBackupUploadActive = async (logger: BaseLogger): Promise<boolean> => {
        if (!this.client) {
            // To preserve existing behaviour, if there is no client, we
            // pretend key backup upload is on.
            //
            // Someone looking to improve this code could try throwing an error
            // here since we don't expect client to be undefined.
            return true;
        }

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
    private cachedKeyBackupUploadActive: boolean | undefined = undefined;

    private onRecordClientInformationSettingChange: CallbackFn = (
        _originalSettingName,
        _roomId,
        _level,
        _newLevel,
        newValue,
    ) => {
        const prevValue = this.shouldRecordClientInformation;

        this.shouldRecordClientInformation = !!newValue;

        if (this.shouldRecordClientInformation !== prevValue) {
            this.updateClientInformation();
        }
    };

    private updateClientInformation = async (): Promise<void> => {
        if (!this.client) return;
        try {
            if (this.shouldRecordClientInformation) {
                await recordClientInformation(this.client, SdkConfig.get(), PlatformPeg.get() ?? undefined);
            } else {
                await removeClientInformation(this.client);
            }
        } catch (error) {
            // this is a best effort operation
            // log the error without rethrowing
            logger.error("Failed to update client information", error);
        }
    };
}

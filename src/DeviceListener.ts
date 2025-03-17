/*
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
} from "matrix-js-sdk/src/matrix";
import { logger as baseLogger, LogSpan } from "matrix-js-sdk/src/logger";
import { CryptoEvent, type KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";
import { type CryptoSessionStateChange } from "@matrix-org/analytics-events/types/typescript/CryptoSessionStateChange";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";

import { PosthogAnalytics } from "./PosthogAnalytics";
import dis from "./dispatcher/dispatcher";
import {
    hideToast as hideBulkUnverifiedSessionsToast,
    showToast as showBulkUnverifiedSessionsToast,
} from "./toasts/BulkUnverifiedSessionsToast";
import {
    hideToast as hideSetupEncryptionToast,
    Kind as SetupKind,
    showToast as showSetupEncryptionToast,
} from "./toasts/SetupEncryptionToast";
import {
    hideToast as hideUnverifiedSessionsToast,
    showToast as showUnverifiedSessionsToast,
} from "./toasts/UnverifiedSessionToast";
import { isSecretStorageBeingAccessed } from "./SecurityManager";
import { type ActionPayload } from "./dispatcher/payloads";
import { Action } from "./dispatcher/actions";
import SdkConfig from "./SdkConfig";
import PlatformPeg from "./PlatformPeg";
import { recordClientInformation, removeClientInformation } from "./utils/device/clientInformation";
import SettingsStore, { type CallbackFn } from "./settings/SettingsStore";
import { UIFeature } from "./settings/UIFeature";
import { isBulkUnverifiedDeviceReminderSnoozed } from "./utils/device/snoozeBulkUnverifiedDeviceReminder";
import { getUserDeviceIds } from "./utils/crypto/deviceInfo";
import { asyncSomeParallel } from "./utils/arrays.ts";

const KEY_BACKUP_POLL_INTERVAL = 5 * 60 * 1000;

/**
 * Unfortunately-named account data key used by Element X to indicate that the user
 * has chosen to disable server side key backups.
 *
 * We need to set and honour this to prevent Element X from automatically turning key backup back on.
 */
export const BACKUP_DISABLED_ACCOUNT_DATA_KEY = "m.org.matrix.custom.backup_disabled";

const logger = baseLogger.getChild("DeviceListener:");

export default class DeviceListener {
    private dispatcherRef?: string;
    // device IDs for which the user has dismissed the verify toast ('Later')
    private dismissed = new Set<string>();
    // has the user dismissed any of the various nag toasts to setup encryption on this device?
    private dismissedThisDeviceToast = false;
    /** Cache of the info about the current key backup on the server. */
    private keyBackupInfo: KeyBackupInfo | null = null;
    /** When `keyBackupInfo` was last updated */
    private keyBackupFetchedAt: number | null = null;
    // We keep a list of our own device IDs so we can batch ones that were already
    // there the last time the app launched into a single toast, but display new
    // ones in their own toasts.
    private ourDeviceIdsAtStart: Set<string> | null = null;
    // The set of device IDs we're currently displaying toasts for
    private displayingToastsForDeviceIds = new Set<string>();
    private running = false;
    // The client with which the instance is running. Only set if `running` is true, otherwise undefined.
    private client?: MatrixClient;
    private shouldRecordClientInformation = false;
    private enableBulkUnverifiedSessionsReminder = true;
    private deviceClientInformationSettingWatcherRef: string | undefined;

    // Remember the current analytics state to avoid sending the same event multiple times.
    private analyticsVerificationState?: string;
    private analyticsRecoveryState?: string;

    public static sharedInstance(): DeviceListener {
        if (!window.mxDeviceListener) window.mxDeviceListener = new DeviceListener();
        return window.mxDeviceListener;
    }

    public start(matrixClient: MatrixClient): void {
        this.running = true;
        this.client = matrixClient;
        this.client.on(CryptoEvent.DevicesUpdated, this.onDevicesUpdated);
        this.client.on(CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
        this.client.on(CryptoEvent.KeysChanged, this.onCrossSingingKeysChanged);
        this.client.on(ClientEvent.AccountData, this.onAccountData);
        this.client.on(ClientEvent.Sync, this.onSync);
        this.client.on(RoomStateEvent.Events, this.onRoomStateEvents);
        this.client.on(ClientEvent.ToDeviceEvent, this.onToDeviceEvent);
        this.shouldRecordClientInformation = SettingsStore.getValue("deviceClientInformationOptIn");
        // only configurable in config, so we don't need to watch the value
        this.enableBulkUnverifiedSessionsReminder = SettingsStore.getValue(UIFeature.BulkUnverifiedSessionsReminder);
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
            this.client.removeListener(CryptoEvent.DevicesUpdated, this.onDevicesUpdated);
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
        this.dismissed.clear();
        this.dismissedThisDeviceToast = false;
        this.keyBackupInfo = null;
        this.keyBackupFetchedAt = null;
        this.keyBackupStatusChecked = false;
        this.ourDeviceIdsAtStart = null;
        this.displayingToastsForDeviceIds = new Set();
        this.client = undefined;
    }

    /**
     * Dismiss notifications about our own unverified devices
     *
     * @param {String[]} deviceIds List of device IDs to dismiss notifications for
     */
    public async dismissUnverifiedSessions(deviceIds: Iterable<string>): Promise<void> {
        logger.debug("Dismissing unverified sessions: " + Array.from(deviceIds).join(","));
        for (const d of deviceIds) {
            this.dismissed.add(d);
        }

        this.recheck();
    }

    public dismissEncryptionSetup(): void {
        this.dismissedThisDeviceToast = true;
        this.recheck();
    }

    private async ensureDeviceIdsAtStartPopulated(): Promise<void> {
        if (this.ourDeviceIdsAtStart === null) {
            this.ourDeviceIdsAtStart = await this.getDeviceIds();
        }
    }

    /** Get the device list for the current user
     *
     * @returns the set of device IDs
     */
    private async getDeviceIds(): Promise<Set<string>> {
        const cli = this.client;
        if (!cli) return new Set();
        return await getUserDeviceIds(cli, cli.getSafeUserId());
    }

    private onDevicesUpdated = async (users: string[], initialFetch?: boolean): Promise<void> => {
        if (!this.client) return;
        // If we didn't know about *any* devices before (ie. it's fresh login),
        // then they are all pre-existing devices, so ignore this and set the
        // devicesAtStart list to the devices that we see after the fetch.
        if (initialFetch) return;

        const myUserId = this.client.getSafeUserId();
        if (users.includes(myUserId)) await this.ensureDeviceIdsAtStartPopulated();

        this.recheck();
    };

    private onUserTrustStatusChanged = (userId: string): void => {
        if (!this.client) return;
        if (userId !== this.client.getUserId()) return;
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
        // which result in account data changes affecting checks below.
        if (
            ev.getType().startsWith("m.secret_storage.") ||
            ev.getType().startsWith("m.cross_signing.") ||
            ev.getType() === "m.megolm_backup.v1"
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

    private recheck(): void {
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

        const cli = this.client;

        // cross-signing support was added to Matrix in MSC1756, which landed in spec v1.1
        if (!(await cli.isVersionSupported("v1.1"))) {
            logSpan.debug("cross-signing not supported");
            return;
        }

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
        const secretStorageReady = await crypto.isSecretStorageReady();
        const crossSigningStatus = await crypto.getCrossSigningStatus();
        const allCrossSigningSecretsCached =
            crossSigningStatus.privateKeysCachedLocally.masterKey &&
            crossSigningStatus.privateKeysCachedLocally.selfSigningKey &&
            crossSigningStatus.privateKeysCachedLocally.userSigningKey;

        const defaultKeyId = await cli.secretStorage.getDefaultKeyId();

        const isCurrentDeviceTrusted =
            crossSigningReady &&
            Boolean(
                (await crypto.getDeviceVerificationStatus(cli.getSafeUserId(), cli.deviceId!))?.crossSigningVerified,
            );

        const allSystemsReady = crossSigningReady && secretStorageReady && allCrossSigningSecretsCached;
        await this.reportCryptoSessionStateToAnalytics(cli);

        if (this.dismissedThisDeviceToast || allSystemsReady) {
            logSpan.info("No toast needed");
            hideSetupEncryptionToast();

            this.checkKeyBackupStatus();
        } else if (await this.shouldShowSetupEncryptionToast()) {
            // make sure our keys are finished downloading
            await crypto.getUserDeviceInfo([cli.getSafeUserId()]);

            if (!crossSigningReady) {
                // This account is legacy and doesn't have cross-signing set up at all.
                // Prompt the user to set it up.
                logSpan.info("Cross-signing not ready: showing SET_UP_ENCRYPTION toast");
                showSetupEncryptionToast(SetupKind.SET_UP_ENCRYPTION);
            } else if (!isCurrentDeviceTrusted) {
                // cross signing is ready but the current device is not trusted: prompt the user to verify
                logSpan.info("Current device not verified: showing VERIFY_THIS_SESSION toast");
                showSetupEncryptionToast(SetupKind.VERIFY_THIS_SESSION);
            } else if (!allCrossSigningSecretsCached) {
                // cross signing ready & device trusted, but we are missing secrets from our local cache.
                // prompt the user to enter their recovery key.
                logSpan.info(
                    "Some secrets not cached: showing KEY_STORAGE_OUT_OF_SYNC toast",
                    crossSigningStatus.privateKeysCachedLocally,
                );
                showSetupEncryptionToast(SetupKind.KEY_STORAGE_OUT_OF_SYNC);
            } else if (defaultKeyId === null) {
                // the user just hasn't set up 4S yet: prompt them to do so (unless they've explicitly said no to key storage)
                const disabledEvent = cli.getAccountData(BACKUP_DISABLED_ACCOUNT_DATA_KEY);
                if (!disabledEvent?.getContent().disabled) {
                    logSpan.info("No default 4S key: showing SET_UP_RECOVERY toast");
                    showSetupEncryptionToast(SetupKind.SET_UP_RECOVERY);
                } else {
                    logSpan.info("No default 4S key but backup disabled: no toast needed");
                }
            } else {
                // some other condition... yikes! Show the 'set up encryption' toast: this is what we previously did
                // in 'other' situations. Possibly we should consider prompting for a full reset in this case?
                logSpan.warn("Couldn't match encryption state to a known case: showing 'setup encryption' prompt", {
                    crossSigningReady,
                    secretStorageReady,
                    allCrossSigningSecretsCached,
                    isCurrentDeviceTrusted,
                    defaultKeyId,
                });
                showSetupEncryptionToast(SetupKind.SET_UP_ENCRYPTION);
            }
        } else {
            logSpan.info("Not yet ready, but shouldShowSetupEncryptionToast==false");
        }

        // This needs to be done after awaiting on getUserDeviceInfo() above, so
        // we make sure we get the devices after the fetch is done.
        await this.ensureDeviceIdsAtStartPopulated();

        // Unverified devices that were there last time the app ran
        // (technically could just be a boolean: we don't actually
        // need to remember the device IDs, but for the sake of
        // symmetry...).
        const oldUnverifiedDeviceIds = new Set<string>();
        // Unverified devices that have appeared since then
        const newUnverifiedDeviceIds = new Set<string>();

        // as long as cross-signing isn't ready,
        // you can't see or dismiss any device toasts
        if (crossSigningReady) {
            const devices = await this.getDeviceIds();
            for (const deviceId of devices) {
                if (deviceId === cli.deviceId) continue;

                const deviceTrust = await crypto.getDeviceVerificationStatus(cli.getSafeUserId(), deviceId);
                if (!deviceTrust?.crossSigningVerified && !this.dismissed.has(deviceId)) {
                    if (this.ourDeviceIdsAtStart?.has(deviceId)) {
                        oldUnverifiedDeviceIds.add(deviceId);
                    } else {
                        newUnverifiedDeviceIds.add(deviceId);
                    }
                }
            }
        }

        logSpan.debug("Old unverified sessions: " + Array.from(oldUnverifiedDeviceIds).join(","));
        logSpan.debug("New unverified sessions: " + Array.from(newUnverifiedDeviceIds).join(","));
        logSpan.debug("Currently showing toasts for: " + Array.from(this.displayingToastsForDeviceIds).join(","));

        const isBulkUnverifiedSessionsReminderSnoozed = isBulkUnverifiedDeviceReminderSnoozed();

        // Display or hide the batch toast for old unverified sessions
        // don't show the toast if the current device is unverified
        if (
            oldUnverifiedDeviceIds.size > 0 &&
            isCurrentDeviceTrusted &&
            this.enableBulkUnverifiedSessionsReminder &&
            !isBulkUnverifiedSessionsReminderSnoozed
        ) {
            showBulkUnverifiedSessionsToast(oldUnverifiedDeviceIds);
        } else {
            hideBulkUnverifiedSessionsToast();
        }

        // Show toasts for new unverified devices if they aren't already there
        for (const deviceId of newUnverifiedDeviceIds) {
            showUnverifiedSessionsToast(deviceId);
        }

        // ...and hide any we don't need any more
        for (const deviceId of this.displayingToastsForDeviceIds) {
            if (!newUnverifiedDeviceIds.has(deviceId)) {
                logSpan.debug("Hiding unverified session toast for " + deviceId);
                hideUnverifiedSessionsToast(deviceId);
            }
        }

        this.displayingToastsForDeviceIds = newUnverifiedDeviceIds;
    }

    /**
     * Reports current recovery state to analytics.
     * Checks if the session is verified and if the recovery is correctly set up (i.e all secrets known locally and in 4S).
     * @param cli - the matrix client
     * @private
     */
    private async reportCryptoSessionStateToAnalytics(cli: MatrixClient): Promise<void> {
        const crypto = cli.getCrypto()!;
        const secretStorageReady = await crypto.isSecretStorageReady();
        const crossSigningStatus = await crypto.getCrossSigningStatus();
        const backupInfo = await this.getKeyBackupInfo();
        const is4SEnabled = (await cli.secretStorage.getDefaultKeyId()) != null;
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
     * Check if key backup is enabled, and if not, raise an `Action.ReportKeyBackupNotEnabled` event (which will
     * trigger an auto-rageshake).
     */
    private checkKeyBackupStatus = async (): Promise<void> => {
        if (this.keyBackupStatusChecked || !this.client) {
            return;
        }
        const activeKeyBackupVersion = await this.client.getCrypto()?.getActiveSessionBackupVersion();
        // if key backup is enabled, no need to check this ever again (XXX: why only when it is enabled?)
        this.keyBackupStatusChecked = !!activeKeyBackupVersion;

        if (!activeKeyBackupVersion) {
            dis.dispatch({ action: Action.ReportKeyBackupNotEnabled });
        }
    };
    private keyBackupStatusChecked = false;

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

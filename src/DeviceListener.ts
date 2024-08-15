/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {
    MatrixEvent,
    ClientEvent,
    EventType,
    MatrixClient,
    RoomStateEvent,
    SyncState,
    ClientStoppedError,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { CryptoEvent } from "matrix-js-sdk/src/crypto";
import { KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";
import { CryptoSessionStateChange } from "@matrix-org/analytics-events/types/typescript/CryptoSessionStateChange";

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
import { accessSecretStorage, isSecretStorageBeingAccessed } from "./SecurityManager";
import { isSecureBackupRequired } from "./utils/WellKnownUtils";
import { ActionPayload } from "./dispatcher/payloads";
import { Action } from "./dispatcher/actions";
import { isLoggedIn } from "./utils/login";
import SdkConfig from "./SdkConfig";
import PlatformPeg from "./PlatformPeg";
import { recordClientInformation, removeClientInformation } from "./utils/device/clientInformation";
import SettingsStore, { CallbackFn } from "./settings/SettingsStore";
import { UIFeature } from "./settings/UIFeature";
import { isBulkUnverifiedDeviceReminderSnoozed } from "./utils/device/snoozeBulkUnverifiedDeviceReminder";
import { getUserDeviceIds } from "./utils/crypto/deviceInfo";

const KEY_BACKUP_POLL_INTERVAL = 5 * 60 * 1000;

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
        this.client.on(CryptoEvent.WillUpdateDevices, this.onWillUpdateDevices);
        this.client.on(CryptoEvent.DevicesUpdated, this.onDevicesUpdated);
        this.client.on(CryptoEvent.DeviceVerificationChanged, this.onDeviceVerificationChanged);
        this.client.on(CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
        this.client.on(CryptoEvent.KeysChanged, this.onCrossSingingKeysChanged);
        this.client.on(ClientEvent.AccountData, this.onAccountData);
        this.client.on(ClientEvent.Sync, this.onSync);
        this.client.on(RoomStateEvent.Events, this.onRoomStateEvents);
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
            this.client.removeListener(CryptoEvent.WillUpdateDevices, this.onWillUpdateDevices);
            this.client.removeListener(CryptoEvent.DevicesUpdated, this.onDevicesUpdated);
            this.client.removeListener(CryptoEvent.DeviceVerificationChanged, this.onDeviceVerificationChanged);
            this.client.removeListener(CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
            this.client.removeListener(CryptoEvent.KeysChanged, this.onCrossSingingKeysChanged);
            this.client.removeListener(ClientEvent.AccountData, this.onAccountData);
            this.client.removeListener(ClientEvent.Sync, this.onSync);
            this.client.removeListener(RoomStateEvent.Events, this.onRoomStateEvents);
        }
        if (this.deviceClientInformationSettingWatcherRef) {
            SettingsStore.unwatchSetting(this.deviceClientInformationSettingWatcherRef);
        }
        if (this.dispatcherRef) {
            dis.unregister(this.dispatcherRef);
            this.dispatcherRef = undefined;
        }
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
        logger.log("Dismissing unverified sessions: " + Array.from(deviceIds).join(","));
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

    private onWillUpdateDevices = async (users: string[], initialFetch?: boolean): Promise<void> => {
        if (!this.client) return;
        // If we didn't know about *any* devices before (ie. it's fresh login),
        // then they are all pre-existing devices, so ignore this and set the
        // devicesAtStart list to the devices that we see after the fetch.
        if (initialFetch) return;

        const myUserId = this.client.getSafeUserId();
        if (users.includes(myUserId)) await this.ensureDeviceIdsAtStartPopulated();

        // No need to do a recheck here: we just need to get a snapshot of our devices
        // before we download any new ones.
    };

    private onDevicesUpdated = (users: string[]): void => {
        if (!this.client) return;
        if (!users.includes(this.client.getSafeUserId())) return;
        this.recheck();
    };

    private onDeviceVerificationChanged = (userId: string): void => {
        if (!this.client) return;
        if (userId !== this.client.getUserId()) return;
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
        if (
            !this.keyBackupInfo ||
            !this.keyBackupFetchedAt ||
            this.keyBackupFetchedAt < now - KEY_BACKUP_POLL_INTERVAL
        ) {
            this.keyBackupInfo = await this.client.getKeyBackupVersion();
            this.keyBackupFetchedAt = now;
        }
        return this.keyBackupInfo;
    }

    private shouldShowSetupEncryptionToast(): boolean {
        // If we're in the middle of a secret storage operation, we're likely
        // modifying the state involved here, so don't add new toasts to setup.
        if (isSecretStorageBeingAccessed()) return false;
        // Show setup toasts once the user is in at least one encrypted room.
        const cli = this.client;
        return cli?.getRooms().some((r) => cli.isRoomEncrypted(r.roomId)) ?? false;
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
        const cli = this.client;

        // cross-signing support was added to Matrix in MSC1756, which landed in spec v1.1
        if (!(await cli.isVersionSupported("v1.1"))) return;

        const crypto = cli.getCrypto();
        if (!crypto) return;

        // don't recheck until the initial sync is complete: lots of account data events will fire
        // while the initial sync is processing and we don't need to recheck on each one of them
        // (we add a listener on sync to do once check after the initial sync is done)
        if (!cli.isInitialSyncComplete()) return;

        const crossSigningReady = await crypto.isCrossSigningReady();
        const secretStorageReady = await crypto.isSecretStorageReady();
        const allSystemsReady = crossSigningReady && secretStorageReady;
        await this.reportCryptoSessionStateToAnalytics(cli);

        if (this.dismissedThisDeviceToast || allSystemsReady) {
            hideSetupEncryptionToast();

            this.checkKeyBackupStatus();
        } else if (this.shouldShowSetupEncryptionToast()) {
            // make sure our keys are finished downloading
            await crypto.getUserDeviceInfo([cli.getSafeUserId()]);

            // cross signing isn't enabled - nag to enable it
            // There are 3 different toasts for:
            if (!(await crypto.getCrossSigningKeyId()) && (await crypto.userHasCrossSigningKeys())) {
                // Cross-signing on account but this device doesn't trust the master key (verify this session)
                showSetupEncryptionToast(SetupKind.VERIFY_THIS_SESSION);
                this.checkKeyBackupStatus();
            } else {
                const backupInfo = await this.getKeyBackupInfo();
                if (backupInfo) {
                    // No cross-signing on account but key backup available (upgrade encryption)
                    showSetupEncryptionToast(SetupKind.UPGRADE_ENCRYPTION);
                } else {
                    // No cross-signing or key backup on account (set up encryption)
                    await cli.waitForClientWellKnown();
                    if (isSecureBackupRequired(cli) && isLoggedIn()) {
                        // If we're meant to set up, and Secure Backup is required,
                        // trigger the flow directly without a toast once logged in.
                        hideSetupEncryptionToast();
                        accessSecretStorage();
                    } else {
                        showSetupEncryptionToast(SetupKind.SET_UP_ENCRYPTION);
                    }
                }
            }
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

        const isCurrentDeviceTrusted =
            crossSigningReady &&
            Boolean(
                (await crypto.getDeviceVerificationStatus(cli.getSafeUserId(), cli.deviceId!))?.crossSigningVerified,
            );

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

        logger.debug("Old unverified sessions: " + Array.from(oldUnverifiedDeviceIds).join(","));
        logger.debug("New unverified sessions: " + Array.from(newUnverifiedDeviceIds).join(","));
        logger.debug("Currently showing toasts for: " + Array.from(this.displayingToastsForDeviceIds).join(","));

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
                logger.debug("Hiding unverified session toast for " + deviceId);
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

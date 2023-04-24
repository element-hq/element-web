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

import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { logger } from "matrix-js-sdk/src/logger";
import { CryptoEvent } from "matrix-js-sdk/src/crypto";
import { ClientEvent, EventType, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { SyncState } from "matrix-js-sdk/src/sync";
import { IKeyBackupInfo } from "matrix-js-sdk/src/crypto/keybackup";

import { MatrixClientPeg } from "./MatrixClientPeg";
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

const KEY_BACKUP_POLL_INTERVAL = 5 * 60 * 1000;

export default class DeviceListener {
    private dispatcherRef: string | null;
    // device IDs for which the user has dismissed the verify toast ('Later')
    private dismissed = new Set<string>();
    // has the user dismissed any of the various nag toasts to setup encryption on this device?
    private dismissedThisDeviceToast = false;
    // cache of the key backup info
    private keyBackupInfo: IKeyBackupInfo | null = null;
    private keyBackupFetchedAt: number | null = null;
    private keyBackupStatusChecked = false;
    // We keep a list of our own device IDs so we can batch ones that were already
    // there the last time the app launched into a single toast, but display new
    // ones in their own toasts.
    private ourDeviceIdsAtStart: Set<string> | null = null;
    // The set of device IDs we're currently displaying toasts for
    private displayingToastsForDeviceIds = new Set<string>();
    private running = false;
    private shouldRecordClientInformation = false;
    private enableBulkUnverifiedSessionsReminder = true;
    private deviceClientInformationSettingWatcherRef: string | undefined;

    public static sharedInstance(): DeviceListener {
        if (!window.mxDeviceListener) window.mxDeviceListener = new DeviceListener();
        return window.mxDeviceListener;
    }

    public start(): void {
        this.running = true;
        MatrixClientPeg.get().on(CryptoEvent.WillUpdateDevices, this.onWillUpdateDevices);
        MatrixClientPeg.get().on(CryptoEvent.DevicesUpdated, this.onDevicesUpdated);
        MatrixClientPeg.get().on(CryptoEvent.DeviceVerificationChanged, this.onDeviceVerificationChanged);
        MatrixClientPeg.get().on(CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
        MatrixClientPeg.get().on(CryptoEvent.KeysChanged, this.onCrossSingingKeysChanged);
        MatrixClientPeg.get().on(ClientEvent.AccountData, this.onAccountData);
        MatrixClientPeg.get().on(ClientEvent.Sync, this.onSync);
        MatrixClientPeg.get().on(RoomStateEvent.Events, this.onRoomStateEvents);
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
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener(CryptoEvent.WillUpdateDevices, this.onWillUpdateDevices);
            MatrixClientPeg.get().removeListener(CryptoEvent.DevicesUpdated, this.onDevicesUpdated);
            MatrixClientPeg.get().removeListener(
                CryptoEvent.DeviceVerificationChanged,
                this.onDeviceVerificationChanged,
            );
            MatrixClientPeg.get().removeListener(CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
            MatrixClientPeg.get().removeListener(CryptoEvent.KeysChanged, this.onCrossSingingKeysChanged);
            MatrixClientPeg.get().removeListener(ClientEvent.AccountData, this.onAccountData);
            MatrixClientPeg.get().removeListener(ClientEvent.Sync, this.onSync);
            MatrixClientPeg.get().removeListener(RoomStateEvent.Events, this.onRoomStateEvents);
        }
        if (this.deviceClientInformationSettingWatcherRef) {
            SettingsStore.unwatchSetting(this.deviceClientInformationSettingWatcherRef);
        }
        if (this.dispatcherRef) {
            dis.unregister(this.dispatcherRef);
            this.dispatcherRef = null;
        }
        this.dismissed.clear();
        this.dismissedThisDeviceToast = false;
        this.keyBackupInfo = null;
        this.keyBackupFetchedAt = null;
        this.keyBackupStatusChecked = false;
        this.ourDeviceIdsAtStart = null;
        this.displayingToastsForDeviceIds = new Set();
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

    private ensureDeviceIdsAtStartPopulated(): void {
        if (this.ourDeviceIdsAtStart === null) {
            const cli = MatrixClientPeg.get();
            this.ourDeviceIdsAtStart = new Set(cli.getStoredDevicesForUser(cli.getUserId()!).map((d) => d.deviceId));
        }
    }

    private onWillUpdateDevices = async (users: string[], initialFetch?: boolean): Promise<void> => {
        // If we didn't know about *any* devices before (ie. it's fresh login),
        // then they are all pre-existing devices, so ignore this and set the
        // devicesAtStart list to the devices that we see after the fetch.
        if (initialFetch) return;

        const myUserId = MatrixClientPeg.get().getUserId()!;
        if (users.includes(myUserId)) this.ensureDeviceIdsAtStartPopulated();

        // No need to do a recheck here: we just need to get a snapshot of our devices
        // before we download any new ones.
    };

    private onDevicesUpdated = (users: string[]): void => {
        if (!users.includes(MatrixClientPeg.get().getUserId()!)) return;
        this.recheck();
    };

    private onDeviceVerificationChanged = (userId: string): void => {
        if (userId !== MatrixClientPeg.get().getUserId()) return;
        this.recheck();
    };

    private onUserTrustStatusChanged = (userId: string): void => {
        if (userId !== MatrixClientPeg.get().getUserId()) return;
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

    // The server doesn't tell us when key backup is set up, so we poll
    // & cache the result
    private async getKeyBackupInfo(): Promise<IKeyBackupInfo | null> {
        const now = new Date().getTime();
        if (
            !this.keyBackupInfo ||
            !this.keyBackupFetchedAt ||
            this.keyBackupFetchedAt < now - KEY_BACKUP_POLL_INTERVAL
        ) {
            this.keyBackupInfo = await MatrixClientPeg.get().getKeyBackupVersion();
            this.keyBackupFetchedAt = now;
        }
        return this.keyBackupInfo;
    }

    private shouldShowSetupEncryptionToast(): boolean {
        // If we're in the middle of a secret storage operation, we're likely
        // modifying the state involved here, so don't add new toasts to setup.
        if (isSecretStorageBeingAccessed()) return false;
        // Show setup toasts once the user is in at least one encrypted room.
        const cli = MatrixClientPeg.get();
        return cli && cli.getRooms().some((r) => cli.isRoomEncrypted(r.roomId));
    }

    private async recheck(): Promise<void> {
        if (!this.running) return; // we have been stopped
        const cli = MatrixClientPeg.get();

        // cross-signing support was added to Matrix in MSC1756, which landed in spec v1.1
        if (!(await cli.isVersionSupported("v1.1"))) return;

        if (!cli.isCryptoEnabled()) return;
        // don't recheck until the initial sync is complete: lots of account data events will fire
        // while the initial sync is processing and we don't need to recheck on each one of them
        // (we add a listener on sync to do once check after the initial sync is done)
        if (!cli.isInitialSyncComplete()) return;

        const crossSigningReady = await cli.isCrossSigningReady();
        const secretStorageReady = await cli.isSecretStorageReady();
        const allSystemsReady = crossSigningReady && secretStorageReady;

        if (this.dismissedThisDeviceToast || allSystemsReady) {
            hideSetupEncryptionToast();

            this.checkKeyBackupStatus();
        } else if (this.shouldShowSetupEncryptionToast()) {
            // make sure our keys are finished downloading
            await cli.downloadKeys([cli.getUserId()!]);
            // cross signing isn't enabled - nag to enable it
            // There are 3 different toasts for:
            if (!cli.getCrossSigningId() && cli.getStoredCrossSigningForUser(cli.getUserId()!)) {
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
                    if (isSecureBackupRequired() && isLoggedIn()) {
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

        // This needs to be done after awaiting on downloadKeys() above, so
        // we make sure we get the devices after the fetch is done.
        this.ensureDeviceIdsAtStartPopulated();

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
                (await cli.getCrypto()?.getDeviceVerificationStatus(cli.getUserId()!, cli.deviceId!))
                    ?.crossSigningVerified,
            );

        // as long as cross-signing isn't ready,
        // you can't see or dismiss any device toasts
        if (crossSigningReady) {
            const devices = cli.getStoredDevicesForUser(cli.getUserId()!);
            for (const device of devices) {
                if (device.deviceId === cli.deviceId) continue;

                const deviceTrust = await cli
                    .getCrypto()!
                    .getDeviceVerificationStatus(cli.getUserId()!, device.deviceId!);
                if (!deviceTrust?.crossSigningVerified && !this.dismissed.has(device.deviceId)) {
                    if (this.ourDeviceIdsAtStart?.has(device.deviceId)) {
                        oldUnverifiedDeviceIds.add(device.deviceId);
                    } else {
                        newUnverifiedDeviceIds.add(device.deviceId);
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

    private checkKeyBackupStatus = async (): Promise<void> => {
        if (this.keyBackupStatusChecked) {
            return;
        }
        // returns null when key backup status hasn't finished being checked
        const isKeyBackupEnabled = MatrixClientPeg.get().getKeyBackupEnabled();
        this.keyBackupStatusChecked = isKeyBackupEnabled !== null;

        if (isKeyBackupEnabled === false) {
            dis.dispatch({ action: Action.ReportKeyBackupNotEnabled });
        }
    };

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
        try {
            if (this.shouldRecordClientInformation) {
                await recordClientInformation(MatrixClientPeg.get(), SdkConfig.get(), PlatformPeg.get() ?? undefined);
            } else {
                await removeClientInformation(MatrixClientPeg.get());
            }
        } catch (error) {
            // this is a best effort operation
            // log the error without rethrowing
            logger.error("Failed to update client information", error);
        }
    };
}

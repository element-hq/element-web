/*
Copyright 2025 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, ClientStoppedError, TypedEventEmitter } from "matrix-js-sdk/src/matrix";
import { logger as baseLogger, LogSpan } from "matrix-js-sdk/src/logger";
import { type CryptoSessionStateChange } from "@matrix-org/analytics-events/types/typescript/CryptoSessionStateChange";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";

import { PosthogAnalytics } from "./PosthogAnalytics";
import dis from "./dispatcher/dispatcher";
import { type ActionPayload } from "./dispatcher/payloads";
import { Action } from "./dispatcher/actions";
import SdkConfig from "./SdkConfig";
import PlatformPeg from "./PlatformPeg";
import { recordClientInformation, removeClientInformation } from "./utils/device/clientInformation";
import SettingsStore, { type CallbackFn } from "./settings/SettingsStore";
import DeviceListenerOtherDevices from "./device-listener/DeviceListenerOtherDevices.ts";
import DeviceListenerCurrentDevice from "./device-listener/DeviceListenerCurrentDevice.ts";
import type DeviceState from "./device-listener/DeviceState.ts";

const logger = baseLogger.getChild("DeviceListener:");

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

    /**
     * All the information about whether other devices are verified. Only set
     * if `running` is true, otherwise undefined.
     */
    public otherDevices?: DeviceListenerOtherDevices;

    /** All the information about whether this device's encrypytion is OK. Only
     * set if `running` is true, otherwise undefined.
     */
    public currentDevice?: DeviceListenerCurrentDevice;

    private running = false;
    // The client with which the instance is running. Only set if `running` is true, otherwise undefined.
    private client?: MatrixClient;
    private shouldRecordClientInformation = false;
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

        this.otherDevices = new DeviceListenerOtherDevices(this, matrixClient);
        this.currentDevice = new DeviceListenerCurrentDevice(this, matrixClient, logger);

        this.client = matrixClient;

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

        SettingsStore.unwatchSetting(this.deviceClientInformationSettingWatcherRef);

        dis.unregister(this.dispatcherRef);

        this.dispatcherRef = undefined;
        this.otherDevices?.stop();
        this.currentDevice?.stop();
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
    public dismissUnverifiedSessions(deviceIds: Iterable<string>): void {
        logger.debug("Dismissing unverified sessions: " + Array.from(deviceIds).join(","));

        this.otherDevices?.dismissUnverifiedSessions(deviceIds);
    }

    public dismissEncryptionSetup(): void {
        this.currentDevice?.dismissEncryptionSetup();
    }

    /**
     * Set the account data "m.org.matrix.custom.backup_disabled" to { "disabled": true }.
     */
    public async recordKeyBackupDisabled(): Promise<void> {
        await this.currentDevice?.recordKeyBackupDisabled();
    }

    /**
     * Set the account data to indicate that recovery is disabled
     */
    public async recordRecoveryDisabled(): Promise<void> {
        await this.currentDevice?.recordRecoveryDisabled();
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
        const thisDevice = this.currentDevice;
        if (!(crypto && thisDevice)) {
            return false;
        }
        const shouldHaveBackup = !(await thisDevice.recheckBackupDisabled());
        const backupKeyCached = (await crypto.getSessionBackupPrivateKey()) !== null;
        const backupKeyStored = await this.client!.isKeyBackupKeyStored();

        if (forgotRecovery) {
            return shouldHaveBackup && !backupKeyCached;
        } else {
            return shouldHaveBackup && !backupKeyCached && !backupKeyStored;
        }
    }

    private onAction = ({ action }: ActionPayload): void => {
        if (action !== Action.OnLoggedIn) return;
        this.recheck();
        this.updateClientInformation();
    };

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

        await this.currentDevice?.recheck(logSpan);
        await this.otherDevices?.recheck(logSpan);

        await this.reportCryptoSessionStateToAnalytics(cli);
    }

    /**
     * Get the state of the device and the user's account.  The device/account
     * state indicates what action the user must take in order to get a
     * self-verified device that is using key backup and recovery.
     */
    public getDeviceState(): DeviceState {
        return this.currentDevice?.getDeviceState() ?? "ok";
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
        const backupInfo = await this.currentDevice?.getKeyBackupInfo();
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

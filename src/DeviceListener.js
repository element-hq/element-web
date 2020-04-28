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

import { MatrixClientPeg } from './MatrixClientPeg';
import SettingsStore from './settings/SettingsStore';
import * as sdk from './index';
import { _t } from './languageHandler';
import ToastStore from './stores/ToastStore';

const KEY_BACKUP_POLL_INTERVAL = 5 * 60 * 1000;
const THIS_DEVICE_TOAST_KEY = 'setupencryption';
const OTHER_DEVICES_TOAST_KEY = 'reviewsessions';

export default class DeviceListener {
    static sharedInstance() {
        if (!global.mx_DeviceListener) global.mx_DeviceListener = new DeviceListener();
        return global.mx_DeviceListener;
    }

    constructor() {
        // device IDs for which the user has dismissed the verify toast ('Later')
        this._dismissed = new Set();
        // has the user dismissed any of the various nag toasts to setup encryption on this device?
        this._dismissedThisDeviceToast = false;

        // cache of the key backup info
        this._keyBackupInfo = null;
        this._keyBackupFetchedAt = null;
    }

    start() {
        MatrixClientPeg.get().on('crypto.devicesUpdated', this._onDevicesUpdated);
        MatrixClientPeg.get().on('deviceVerificationChanged', this._onDeviceVerificationChanged);
        MatrixClientPeg.get().on('userTrustStatusChanged', this._onUserTrustStatusChanged);
        MatrixClientPeg.get().on('crossSigning.keysChanged', this._onCrossSingingKeysChanged);
        MatrixClientPeg.get().on('accountData', this._onAccountData);
        MatrixClientPeg.get().on('sync', this._onSync);
        this._recheck();
    }

    stop() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener('crypto.devicesUpdated', this._onDevicesUpdated);
            MatrixClientPeg.get().removeListener('deviceVerificationChanged', this._onDeviceVerificationChanged);
            MatrixClientPeg.get().removeListener('userTrustStatusChanged', this._onUserTrustStatusChanged);
            MatrixClientPeg.get().removeListener('crossSigning.keysChanged', this._onCrossSingingKeysChanged);
            MatrixClientPeg.get().removeListener('accountData', this._onAccountData);
            MatrixClientPeg.get().removeListener('sync', this._onSync);
        }
        this._dismissed.clear();
        this._dismissedThisDeviceToast = false;
        this._keyBackupInfo = null;
        this._keyBackupFetchedAt = null;
    }

    async dismissVerifications() {
        const cli = MatrixClientPeg.get();
        const devices = await cli.getStoredDevicesForUser(cli.getUserId());
        this._dismissed = new Set(devices.filter(d => d.deviceId !== cli.deviceId).map(d => d.deviceId));

        this._recheck();
    }

    dismissEncryptionSetup() {
        this._dismissedThisDeviceToast = true;
        this._recheck();
    }

    _onDevicesUpdated = (users) => {
        if (!users.includes(MatrixClientPeg.get().getUserId())) return;
        this._recheck();
    }

    _onDeviceVerificationChanged = (userId) => {
        if (userId !== MatrixClientPeg.get().getUserId()) return;
        this._recheck();
    }

    _onUserTrustStatusChanged = (userId, trustLevel) => {
        if (userId !== MatrixClientPeg.get().getUserId()) return;
        this._recheck();
    }

    _onCrossSingingKeysChanged = () => {
        this._recheck();
    }

    _onAccountData = (ev) => {
        // User may have:
        // * migrated SSSS to symmetric
        // * uploaded keys to secret storage
        // * completed secret storage creation
        // which result in account data changes affecting checks below.
        if (
            ev.getType().startsWith('m.secret_storage.') ||
            ev.getType().startsWith('m.cross_signing.')
        ) {
            this._recheck();
        }
    }

    _onSync = (state, prevState) => {
        if (state === 'PREPARED' && prevState === null) this._recheck();
    }

    // The server doesn't tell us when key backup is set up, so we poll
    // & cache the result
    async _getKeyBackupInfo() {
        const now = (new Date()).getTime();
        if (!this._keyBackupInfo || this._keyBackupFetchedAt < now - KEY_BACKUP_POLL_INTERVAL) {
            this._keyBackupInfo = await MatrixClientPeg.get().getKeyBackupVersion();
            this._keyBackupFetchedAt = now;
        }
        return this._keyBackupInfo;
    }

    async _recheck() {
        const cli = MatrixClientPeg.get();

        if (
            !SettingsStore.getValue("feature_cross_signing") ||
            !await cli.doesServerSupportUnstableFeature("org.matrix.e2e_cross_signing")
        ) return;

        if (!cli.isCryptoEnabled()) return;
        // don't recheck until the initial sync is complete: lots of account data events will fire
        // while the initial sync is processing and we don't need to recheck on each one of them
        // (we add a listener on sync to do once check after the initial sync is done)
        if (!cli.isInitialSyncComplete()) return;

        const crossSigningReady = await cli.isCrossSigningReady();

        if (this._dismissedThisDeviceToast) {
            ToastStore.sharedInstance().dismissToast(THIS_DEVICE_TOAST_KEY);
        } else {
            if (!crossSigningReady) {
                // make sure our keys are finished downlaoding
                await cli.downloadKeys([cli.getUserId()]);
                // cross signing isn't enabled - nag to enable it
                // There are 3 different toasts for:
                if (cli.getStoredCrossSigningForUser(cli.getUserId())) {
                    // Cross-signing on account but this device doesn't trust the master key (verify this session)
                    ToastStore.sharedInstance().addOrReplaceToast({
                        key: THIS_DEVICE_TOAST_KEY,
                        title: _t("Verify this session"),
                        icon: "verification_warning",
                        props: {kind: 'verify_this_session'},
                        component: sdk.getComponent("toasts.SetupEncryptionToast"),
                    });
                } else {
                    const backupInfo = await this._getKeyBackupInfo();
                    if (backupInfo) {
                        // No cross-signing on account but key backup available (upgrade encryption)
                        ToastStore.sharedInstance().addOrReplaceToast({
                            key: THIS_DEVICE_TOAST_KEY,
                            title: _t("Encryption upgrade available"),
                            icon: "verification_warning",
                            props: {kind: 'upgrade_encryption'},
                            component: sdk.getComponent("toasts.SetupEncryptionToast"),
                        });
                    } else {
                        // No cross-signing or key backup on account (set up encryption)
                        ToastStore.sharedInstance().addOrReplaceToast({
                            key: THIS_DEVICE_TOAST_KEY,
                            title: _t("Set up encryption"),
                            icon: "verification_warning",
                            props: {kind: 'set_up_encryption'},
                            component: sdk.getComponent("toasts.SetupEncryptionToast"),
                        });
                    }
                }
                return;
            } else if (await cli.secretStorageKeyNeedsUpgrade()) {
                ToastStore.sharedInstance().addOrReplaceToast({
                    key: THIS_DEVICE_TOAST_KEY,
                    title: _t("Encryption upgrade available"),
                    icon: "verification_warning",
                    props: {kind: 'upgrade_ssss'},
                    component: sdk.getComponent("toasts.SetupEncryptionToast"),
                });
            } else {
                // cross-signing is ready, and we don't need to upgrade encryption
                ToastStore.sharedInstance().dismissToast(THIS_DEVICE_TOAST_KEY);
            }
        }

        // as long as cross-signing isn't ready,
        // you can't see or dismiss any device toasts
        if (crossSigningReady) {
            let haveUnverifiedDevices = false;

            const devices = await cli.getStoredDevicesForUser(cli.getUserId());
            for (const device of devices) {
                if (device.deviceId == cli.deviceId) continue;

                const deviceTrust = await cli.checkDeviceTrust(cli.getUserId(), device.deviceId);
                if (!deviceTrust.isCrossSigningVerified() && !this._dismissed.has(device.deviceId)) {
                    haveUnverifiedDevices = true;
                    break;
                }
            }

            if (haveUnverifiedDevices) {
                ToastStore.sharedInstance().addOrReplaceToast({
                    key: OTHER_DEVICES_TOAST_KEY,
                    title: _t("Review where you’re logged in"),
                    icon: "verification_warning",
                    component: sdk.getComponent("toasts.UnverifiedSessionToast"),
                });
            } else {
                ToastStore.sharedInstance().dismissToast(OTHER_DEVICES_TOAST_KEY);
            }
        }
    }
}

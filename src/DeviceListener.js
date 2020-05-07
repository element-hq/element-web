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

function toastKey(deviceId) {
    return "unverified_session_" + deviceId;
}

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

        // We keep a list of our own device IDs so we can batch ones that were already
        // there the last time the app launched into a single toast, but display new
        // ones in their own toasts.
        this._ourDeviceIdsAtStart = null;

        // The set of device IDs we're currently displaying toasts for
        this._displayingToastsForDeviceIds = new Set();
    }

    start() {
        MatrixClientPeg.get().on('crypto.willUpdateDevices', this._onWillUpdateDevices);
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
            MatrixClientPeg.get().removeListener('crypto.willUpdateDevices', this._onWillUpdateDevices);
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
        this._ourDeviceIdsAtStart = null;
        this._displayingToastsForDeviceIds = new Set();
    }

    /**
     * Dismiss notifications about our own unverified devices
     *
     * @param {String[]} deviceIds List of device IDs to dismiss notifications for
     */
    async dismissUnverifiedSessions(deviceIds) {
        for (const d of deviceIds) {
            this._dismissed.add(d);
        }

        this._recheck();
    }

    dismissEncryptionSetup() {
        this._dismissedThisDeviceToast = true;
        this._recheck();
    }

    _ensureDeviceIdsAtStartPopulated() {
        if (this._ourDeviceIdsAtStart === null) {
            const cli = MatrixClientPeg.get();
            this._ourDeviceIdsAtStart = new Set(
                cli.getStoredDevicesForUser(cli.getUserId()).map(d => d.deviceId),
            );
        }
    }

    _onWillUpdateDevices = async (users, initialFetch) => {
        // If we didn't know about *any* devices before (ie. it's fresh login),
        // then they are all pre-existing devices, so ignore this and set the
        // devicesAtStart list to the devices that we see after the fetch.
        if (initialFetch) return;

        const myUserId = MatrixClientPeg.get().getUserId();
        if (users.includes(myUserId)) this._ensureDeviceIdsAtStartPopulated();

        // No need to do a recheck here: we just need to get a snapshot of our devices
        // before we download any new ones.
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

        // This needs to be done after awaiting on downloadKeys() above, so
        // we make sure we get the devices after the fetch is done.
        this._ensureDeviceIdsAtStartPopulated();

        // Unverified devices that were there last time the app ran
        // (technically could just be a boolean: we don't actually
        // need to remember the device IDs, but for the sake of
        // symmetry...).
        const oldUnverifiedDeviceIds = new Set();
        // Unverified devices that have appeared since then
        const newUnverifiedDeviceIds = new Set();

        // as long as cross-signing isn't ready,
        // you can't see or dismiss any device toasts
        if (crossSigningReady) {
            const devices = cli.getStoredDevicesForUser(cli.getUserId());
            for (const device of devices) {
                if (device.deviceId == cli.deviceId) continue;

                const deviceTrust = await cli.checkDeviceTrust(cli.getUserId(), device.deviceId);
                if (!deviceTrust.isCrossSigningVerified() && !this._dismissed.has(device.deviceId)) {
                    if (this._ourDeviceIdsAtStart.has(device.deviceId)) {
                        oldUnverifiedDeviceIds.add(device.deviceId);
                    } else {
                        newUnverifiedDeviceIds.add(device.deviceId);
                    }
                }
            }
        }

        // Display or hide the batch toast for old unverified sessions
        if (oldUnverifiedDeviceIds.size > 0) {
            ToastStore.sharedInstance().addOrReplaceToast({
                key: OTHER_DEVICES_TOAST_KEY,
                title: _t("Review where you’re logged in"),
                icon: "verification_warning",
                priority: ToastStore.PRIORITY_LOW,
                props: {
                    deviceIds: oldUnverifiedDeviceIds,
                },
                component: sdk.getComponent("toasts.BulkUnverifiedSessionsToast"),
            });
        } else {
            ToastStore.sharedInstance().dismissToast(OTHER_DEVICES_TOAST_KEY);
        }

        // Show toasts for new unverified devices if they aren't already there
        for (const deviceId of newUnverifiedDeviceIds) {
            ToastStore.sharedInstance().addOrReplaceToast({
                key: toastKey(deviceId),
                title: _t("New login. Was this you?"),
                icon: "verification_warning",
                props: { deviceId },
                component: sdk.getComponent("toasts.UnverifiedSessionToast"),
            });
        }

        // ...and hide any we don't need any more
        for (const deviceId of this._displayingToastsForDeviceIds) {
            if (!newUnverifiedDeviceIds.has(deviceId)) {
                ToastStore.sharedInstance().dismissToast(toastKey(deviceId));
            }
        }

        this._displayingToastsForDeviceIds = newUnverifiedDeviceIds;
    }
}

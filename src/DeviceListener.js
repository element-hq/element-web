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

function toastKey(device) {
    return 'newsession_' + device.deviceId;
}

export default class DeviceListener {
    static sharedInstance() {
        if (!global.mx_DeviceListener) global.mx_DeviceListener = new DeviceListener();
        return global.mx_DeviceListener;
    }

    constructor() {
        // device IDs for which the user has dismissed the verify toast ('Later')
        this._dismissed = new Set();
    }

    start() {
        MatrixClientPeg.get().on('crypto.devicesUpdated', this._onDevicesUpdated);
        MatrixClientPeg.get().on('deviceVerificationChanged', this._onDeviceVerificationChanged);
        this.recheck();
    }

    stop() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener('crypto.devicesUpdated', this._onDevicesUpdated);
            MatrixClientPeg.get().removeListener('deviceVerificationChanged', this._onDeviceVerificationChanged);
        }
        this._dismissed.clear();
    }

    dismissVerification(deviceId) {
        this._dismissed.add(deviceId);
        this.recheck();
    }

    _onDevicesUpdated = (users) => {
        if (!users.includes(MatrixClientPeg.get().getUserId())) return;
        this.recheck();
    }

    _onDeviceVerificationChanged = (users) => {
        if (!users.includes(MatrixClientPeg.get().getUserId())) return;
        this.recheck();
    }

    async recheck() {
        if (!SettingsStore.isFeatureEnabled("feature_cross_signing")) return;
        const cli = MatrixClientPeg.get();

        if (!cli.isCryptoEnabled()) return false;

        const devices = await cli.getStoredDevicesForUser(cli.getUserId());
        for (const device of devices) {
            if (device.deviceId == cli.deviceId) continue;

            const deviceTrust = await cli.checkDeviceTrust(cli.getUserId(), device.deviceId);
            if (deviceTrust.isCrossSigningVerified() || this._dismissed.has(device.deviceId)) {
                ToastStore.sharedInstance().dismissToast(toastKey(device));
            } else {
                ToastStore.sharedInstance().addOrReplaceToast({
                    key: toastKey(device),
                    title: _t("New Session"),
                    icon: "verification_warning",
                    props: {deviceId: device.deviceId},
                    component: sdk.getComponent("toasts.NewSessionToast"),
                });
            }
        }
    }
}

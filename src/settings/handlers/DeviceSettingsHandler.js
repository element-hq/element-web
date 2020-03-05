/*
Copyright 2017 Travis Ralston
Copyright 2019 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import SettingsHandler from "./SettingsHandler";
import {MatrixClientPeg} from "../../MatrixClientPeg";
import {SettingLevel} from "../SettingsStore";

/**
 * Gets and sets settings at the "device" level for the current device.
 * This handler does not make use of the roomId parameter. This handler
 * will special-case features to support legacy settings.
 */
export default class DeviceSettingsHandler extends SettingsHandler {
    /**
     * Creates a new device settings handler
     * @param {string[]} featureNames The names of known features.
     * @param {WatchManager} watchManager The watch manager to notify updates to
     */
    constructor(featureNames, watchManager) {
        super();
        this._featureNames = featureNames;
        this._watchers = watchManager;
    }

    getValue(settingName, roomId) {
        if (this._featureNames.includes(settingName)) {
            return this._readFeature(settingName);
        }

        // Special case notifications
        if (settingName === "notificationsEnabled") {
            const value = localStorage.getItem("notifications_enabled");
            if (typeof(value) === "string") return value === "true";
            return null; // wrong type or otherwise not set
        } else if (settingName === "notificationBodyEnabled") {
            const value = localStorage.getItem("notifications_body_enabled");
            if (typeof(value) === "string") return value === "true";
            return null; // wrong type or otherwise not set
        } else if (settingName === "audioNotificationsEnabled") {
            const value = localStorage.getItem("audio_notifications_enabled");
            if (typeof(value) === "string") return value === "true";
            return null; // wrong type or otherwise not set
        }

        // Special case the right panel - see `setValue` for rationale.
        if ([
            "showRightPanelInRoom",
            "showRightPanelInGroup",
            "lastRightPanelPhaseForRoom",
            "lastRightPanelPhaseForGroup",
        ].includes(settingName)) {
            const val = JSON.parse(localStorage.getItem(`mx_${settingName}`) || "{}");
            return val['value'];
        }

        const settings = this._getSettings() || {};
        return settings[settingName];
    }

    setValue(settingName, roomId, newValue) {
        if (this._featureNames.includes(settingName)) {
            this._writeFeature(settingName, newValue);
            return Promise.resolve();
        }

        // Special case notifications
        if (settingName === "notificationsEnabled") {
            localStorage.setItem("notifications_enabled", newValue);
            this._watchers.notifyUpdate(settingName, null, SettingLevel.DEVICE, newValue);
            return Promise.resolve();
        } else if (settingName === "notificationBodyEnabled") {
            localStorage.setItem("notifications_body_enabled", newValue);
            this._watchers.notifyUpdate(settingName, null, SettingLevel.DEVICE, newValue);
            return Promise.resolve();
        } else if (settingName === "audioNotificationsEnabled") {
            localStorage.setItem("audio_notifications_enabled", newValue);
            this._watchers.notifyUpdate(settingName, null, SettingLevel.DEVICE, newValue);
            return Promise.resolve();
        }

        // Special case the right panel because we want to be able to update these all
        // concurrently without stomping on one another. We could use async/await, though
        // that introduces just enough latency to be annoying.
        if ([
            "showRightPanelInRoom",
            "showRightPanelInGroup",
            "lastRightPanelPhaseForRoom",
            "lastRightPanelPhaseForGroup",
        ].includes(settingName)) {
            localStorage.setItem(`mx_${settingName}`, JSON.stringify({value: newValue}));
            this._watchers.notifyUpdate(settingName, null, SettingLevel.DEVICE, newValue);
            return Promise.resolve();
        }

        const settings = this._getSettings() || {};
        settings[settingName] = newValue;
        localStorage.setItem("mx_local_settings", JSON.stringify(settings));
        this._watchers.notifyUpdate(settingName, null, SettingLevel.DEVICE, newValue);

        return Promise.resolve();
    }

    canSetValue(settingName, roomId) {
        return true; // It's their device, so they should be able to
    }

    isSupported() {
        return localStorage !== undefined && localStorage !== null;
    }

    watchSetting(settingName, roomId, cb) {
        this._watchers.watchSetting(settingName, roomId, cb);
    }

    unwatchSetting(cb) {
        this._watchers.unwatchSetting(cb);
    }

    _getSettings() {
        const value = localStorage.getItem("mx_local_settings");
        if (!value) return null;
        return JSON.parse(value);
    }

    // Note: features intentionally don't use the same key as settings to avoid conflicts
    // and to be backwards compatible.

    _readFeature(featureName) {
        if (MatrixClientPeg.get() && MatrixClientPeg.get().isGuest()) {
            // Guests should not have any labs features enabled.
            return false;
        }

        const value = localStorage.getItem("mx_labs_feature_" + featureName);
        if (value === "true") return true;
        if (value === "false") return false;
        // Try to read the next config level for the feature.
        return null;
    }

    _writeFeature(featureName, enabled) {
        localStorage.setItem("mx_labs_feature_" + featureName, enabled);
        this._watchers.notifyUpdate(featureName, null, SettingLevel.DEVICE, enabled);
    }
}

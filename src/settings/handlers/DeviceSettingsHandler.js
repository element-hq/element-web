/*
Copyright 2017 Travis Ralston

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

import Promise from 'bluebird';
import SettingsHandler from "./SettingsHandler";
import MatrixClientPeg from "../../MatrixClientPeg";

/**
 * Gets and sets settings at the "device" level for the current device.
 * This handler does not make use of the roomId parameter. This handler
 * will special-case features to support legacy settings.
 */
export default class DeviceSettingsHandler extends SettingsHandler {
    /**
     * Creates a new device settings handler
     * @param {string[]} featureNames The names of known features.
     */
    constructor(featureNames) {
        super();
        this._featureNames = featureNames;
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
            return Promise.resolve();
        } else if (settingName === "notificationBodyEnabled") {
            localStorage.setItem("notifications_body_enabled", newValue);
            return Promise.resolve();
        } else if (settingName === "audioNotificationsEnabled") {
            localStorage.setItem("audio_notifications_enabled", newValue);
            return Promise.resolve();
        }

        const settings = this._getSettings() || {};
        settings[settingName] = newValue;
        localStorage.setItem("mx_local_settings", JSON.stringify(settings));

        return Promise.resolve();
    }

    canSetValue(settingName, roomId) {
        return true; // It's their device, so they should be able to
    }

    isSupported() {
        return localStorage !== undefined && localStorage !== null;
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
        return value === "true";
    }

    _writeFeature(featureName, enabled) {
        localStorage.setItem("mx_labs_feature_" + featureName, enabled);
    }
}

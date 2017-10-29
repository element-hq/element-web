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
import DeviceSettingsHandler from "./DeviceSettingsHandler";
import RoomDeviceSettingsHandler from "./RoomDeviceSettingsHandler";
import DefaultSettingsHandler from "./DefaultSettingsHandler";
import RoomAccountSettingsHandler from "./RoomAccountSettingsHandler";
import AccountSettingsHandler from "./AccountSettingsHandler";
import RoomSettingsHandler from "./RoomSettingsHandler";
import ConfigSettingsHandler from "./ConfigSettingsHandler";
import {_t, _td} from '../languageHandler';
import SdkConfig from "../SdkConfig";

// Preset levels for room-based settings (eg: URL previews).
// Doesn't include 'room' because most settings don't need it. Use .concat('room') to add.
const LEVELS_PRESET_ROOM = ['device', 'room-device', 'room-account', 'account'];

// Preset levels for account-based settings (eg: interface language).
const LEVELS_PRESET_ACCOUNT = ['device', 'account'];

// Preset levels for features (labs) settings.
const LEVELS_PRESET_FEATURE = ['device'];

const SETTINGS = {
    "my-setting": {
        isFeature: false, // optional
        displayName: _td("Cool Name"),
        supportedLevels: [
            // The order does not matter.

            "device",        // Affects the current device only
            "room-device",   // Affects the current room on the current device
            "room-account",  // Affects the current room for the current account
            "account",       // Affects the current account
            "room",          // Affects the current room (controlled by room admins)

            // "default" and "config" are always supported and do not get listed here.
        ],
        defaults: {
            your: "value",
        },
    },

    // TODO: Populate this
};

// Convert the above into simpler formats for the handlers
const defaultSettings = {};
const featureNames = [];
for (const key of Object.keys(SETTINGS)) {
    defaultSettings[key] = SETTINGS[key].defaults;
    if (SETTINGS[key].isFeature) featureNames.push(key);
}

const LEVEL_HANDLERS = {
    "device": new DeviceSettingsHandler(featureNames),
    "room-device": new RoomDeviceSettingsHandler(),
    "room-account": new RoomAccountSettingsHandler(),
    "account": new AccountSettingsHandler(),
    "room": new RoomSettingsHandler(),
    "config": new ConfigSettingsHandler(),
    "default": new DefaultSettingsHandler(defaultSettings),
};

/**
 * Controls and manages application settings by providing varying levels at which the
 * setting value may be specified. The levels are then used to determine what the setting
 * value should be given a set of circumstances. The levels, in priority order, are:
 * - "device"         - Values are determined by the current device
 * - "room-device"    - Values are determined by the current device for a particular room
 * - "room-account"   - Values are determined by the current account for a particular room
 * - "account"        - Values are determined by the current account
 * - "room"           - Values are determined by a particular room (by the room admins)
 * - "config"         - Values are determined by the config.json
 * - "default"        - Values are determined by the hardcoded defaults
 *
 * Each level has a different method to storing the setting value. For implementation
 * specific details, please see the handlers. The "config" and "default" levels are
 * both always supported on all platforms. All other settings should be guarded by
 * isLevelSupported() prior to attempting to set the value.
 *
 * Settings can also represent features. Features are significant portions of the
 * application that warrant a dedicated setting to toggle them on or off. Features are
 * special-cased to ensure that their values respect the configuration (for example, a
 * feature may be reported as disabled even though a user has specifically requested it
 * be enabled).
 */
export default class SettingsStore {
    /**
     * Gets the translated display name for a given setting
     * @param {string} settingName The setting to look up.
     * @return {String} The display name for the setting, or null if not found.
     */
    static getDisplayName(settingName) {
        if (!SETTINGS[settingName] || !SETTINGS[settingName].displayName) return null;
        return _t(SETTINGS[settingName].displayName);
    }

    /**
     * Determines if a setting is also a feature.
     * @param {string} settingName The setting to look up.
     * @return {boolean} True if the setting is a feature.
     */
    static isFeature(settingName) {
        if (!SETTINGS[settingName]) return false;
        return SETTINGS[settingName].isFeature;
    }

    /**
     * Determines if a given feature is enabled. The feature given must be a known
     * feature.
     * @param {string} settingName The name of the setting that is a feature.
     * @param {String} roomId The optional room ID to validate in, may be null.
     * @return {boolean} True if the feature is enabled, false otherwise
     */
    static isFeatureEnabled(settingName, roomId = null) {
        if (!SettingsStore.isFeature(settingName)) {
            throw new Error("Setting " + settingName + " is not a feature");
        }

        return SettingsStore.getValue(settingName, roomId);
    }

    /**
     * Gets the value of a setting. The room ID is optional if the setting is not to
     * be applied to any particular room, otherwise it should be supplied.
     * @param {string} settingName The name of the setting to read the value of.
     * @param {String} roomId The room ID to read the setting value in, may be null.
     * @return {*} The value, or null if not found
     */
    static getValue(settingName, roomId) {
        const levelOrder = [
            'device', 'room-device', 'room-account', 'account', 'room', 'config', 'default',
        ];

        if (SettingsStore.isFeature(settingName)) {
            const configValue = SettingsStore._getFeatureState(settingName);
            if (configValue === "enable") return true;
            if (configValue === "disable") return false;
            // else let it fall through the default process
        }

        const handlers = SettingsStore._getHandlers(settingName);

        for (const level of levelOrder) {
            let handler = handlers[level];
            if (!handler) continue;

            const value = handler.getValue(settingName, roomId);
            if (!value) continue;
            return value;
        }
        return null;
    }

    /**
     * Sets the value for a setting. The room ID is optional if the setting is not being
     * set for a particular room, otherwise it should be supplied. The value may be null
     * to indicate that the level should no longer have an override.
     * @param {string} settingName The name of the setting to change.
     * @param {String} roomId The room ID to change the value in, may be null.
     * @param {"device"|"room-device"|"room-account"|"account"|"room"} level The level
     * to change the value at.
     * @param {*} value The new value of the setting, may be null.
     * @return {Promise} Resolves when the setting has been changed.
     */
    static setValue(settingName, roomId, level, value) {
        const handler = SettingsStore._getHandler(settingName, level);
        if (!handler) {
            throw new Error("Setting " + settingName + " does not have a handler for " + level);
        }

        if (!handler.canSetValue(settingName, roomId)) {
            throw new Error("User cannot set " + settingName + " at level " + level);
        }

        return handler.setValue(settingName, roomId, value);
    }

    /**
     * Determines if the current user is permitted to set the given setting at the given
     * level for a particular room. The room ID is optional if the setting is not being
     * set for a particular room, otherwise it should be supplied.
     * @param {string} settingName The name of the setting to check.
     * @param {String} roomId The room ID to check in, may be null.
     * @param {"device"|"room-device"|"room-account"|"account"|"room"} level The level to
     * check at.
     * @return {boolean} True if the user may set the setting, false otherwise.
     */
    static canSetValue(settingName, roomId, level) {
        const handler = SettingsStore._getHandler(settingName, level);
        if (!handler) return false;
        return handler.canSetValue(settingName, roomId);
    }

    /**
     * Determines if the given level is supported on this device.
     * @param {"device"|"room-device"|"room-account"|"account"|"room"} level The level
     * to check the feasibility of.
     * @return {boolean} True if the level is supported, false otherwise.
     */
    static isLevelSupported(level) {
        if (!LEVEL_HANDLERS[level]) return false;
        return LEVEL_HANDLERS[level].isSupported();
    }

    static _getHandler(settingName, level) {
        const handlers = SettingsStore._getHandlers(settingName);
        if (!handlers[level]) return null;
        return handlers[level];
    }

    static _getHandlers(settingName) {
        if (!SETTINGS[settingName]) return {};

        const handlers = {};
        for (let level of SETTINGS[settingName].supportedLevels) {
            if (!LEVEL_HANDLERS[level]) throw new Error("Unexpected level " + level);
            handlers[level] = LEVEL_HANDLERS[level];
        }

        return handlers;
    }

    static _getFeatureState(settingName) {
        const featuresConfig = SdkConfig.get()['features'];
        const enableLabs = SdkConfig.get()['enableLabs']; // we'll honour the old flag

        let featureState = enableLabs ? "labs" : "disable";
        if (featuresConfig && featuresConfig[settingName] !== undefined) {
            featureState = featuresConfig[settingName];
        }

        const allowedStates = ['enable', 'disable', 'labs'];
        if (!allowedStates.contains(featureState)) {
            console.warn("Feature state '" + featureState + "' is invalid for " + settingName);
            featureState = "disable"; // to prevent accidental features.
        }

        return featureState;
    }
}

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

import DeviceSettingsHandler from "./handlers/DeviceSettingsHandler";
import RoomDeviceSettingsHandler from "./handlers/RoomDeviceSettingsHandler";
import DefaultSettingsHandler from "./handlers/DefaultSettingsHandler";
import RoomAccountSettingsHandler from "./handlers/RoomAccountSettingsHandler";
import AccountSettingsHandler from "./handlers/AccountSettingsHandler";
import RoomSettingsHandler from "./handlers/RoomSettingsHandler";
import ConfigSettingsHandler from "./handlers/ConfigSettingsHandler";
import {_t} from '../languageHandler';
import SdkConfig from "../SdkConfig";
import {SETTINGS} from "./Settings";
import LocalEchoWrapper from "./handlers/LocalEchoWrapper";

/**
 * Represents the various setting levels supported by the SettingsStore.
 */
export const SettingLevel = {
    // Note: This enum is not used in this class or in the Settings file
    // This should always be used elsewhere in the project.
    DEVICE: "device",
    ROOM_DEVICE: "room-device",
    ROOM_ACCOUNT: "room-account",
    ACCOUNT: "account",
    ROOM: "room",
    CONFIG: "config",
    DEFAULT: "default",
};

// Convert the settings to easier to manage objects for the handlers
const defaultSettings = {};
const featureNames = [];
for (const key of Object.keys(SETTINGS)) {
    defaultSettings[key] = SETTINGS[key].default;
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

// Wrap all the handlers with local echo
for (const key of Object.keys(LEVEL_HANDLERS)) {
    LEVEL_HANDLERS[key] = new LocalEchoWrapper(LEVEL_HANDLERS[key]);
}

const LEVEL_ORDER = [
    'device', 'room-device', 'room-account', 'account', 'room', 'config', 'default',
];

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
     * @param {"device"|"room-device"|"room-account"|"account"|"room"|"config"|"default"} atLevel
     * The level to get the display name for; Defaults to 'default'.
     * @return {String} The display name for the setting, or null if not found.
     */
    static getDisplayName(settingName, atLevel = "default") {
        if (!SETTINGS[settingName] || !SETTINGS[settingName].displayName) return null;

        let displayName = SETTINGS[settingName].displayName;
        if (displayName instanceof Object) {
            if (displayName[atLevel]) displayName = displayName[atLevel];
            else displayName = displayName["default"];
        }

        return _t(displayName);
    }

    /**
     * Returns a list of all available labs feature names
     * @returns {string[]} The list of available feature names
     */
    static getLabsFeatures() {
        const possibleFeatures = Object.keys(SETTINGS).filter((s) => SettingsStore.isFeature(s));

        const enableLabs = SdkConfig.get()["enableLabs"];
        if (enableLabs) return possibleFeatures;

        return possibleFeatures.filter((s) => SettingsStore._getFeatureState(s) === "labs");
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
     * Sets a feature as enabled or disabled on the current device.
     * @param {string} settingName The name of the setting.
     * @param {boolean} value True to enable the feature, false otherwise.
     * @returns {Promise} Resolves when the setting has been set.
     */
    static setFeatureEnabled(settingName, value) {
        // Verify that the setting is actually a setting
        if (!SETTINGS[settingName]) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }
        if (!SettingsStore.isFeature(settingName)) {
            throw new Error("Setting " + settingName + " is not a feature");
        }

        return SettingsStore.setValue(settingName, null, "device", value);
    }

    /**
     * Gets the value of a setting. The room ID is optional if the setting is not to
     * be applied to any particular room, otherwise it should be supplied.
     * @param {string} settingName The name of the setting to read the value of.
     * @param {String} roomId The room ID to read the setting value in, may be null.
     * @param {boolean} excludeDefault True to disable using the default value.
     * @return {*} The value, or null if not found
     */
    static getValue(settingName, roomId = null, excludeDefault = false) {
        // Verify that the setting is actually a setting
        if (!SETTINGS[settingName]) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

        const setting = SETTINGS[settingName];
        const levelOrder = (setting.supportedLevelsAreOrdered ? setting.supportedLevels : LEVEL_ORDER);

        return SettingsStore.getValueAt(levelOrder[0], settingName, roomId, false, excludeDefault);
    }

    /**
     * Gets a setting's value at a particular level, ignoring all levels that are more specific.
     * @param {"device"|"room-device"|"room-account"|"account"|"room"|"config"|"default"} level The
     * level to look at.
     * @param {string} settingName The name of the setting to read.
     * @param {String} roomId The room ID to read the setting value in, may be null.
     * @param {boolean} explicit If true, this method will not consider other levels, just the one
     * provided. Defaults to false.
     * @param {boolean} excludeDefault True to disable using the default value.
     * @return {*} The value, or null if not found.
     */
    static getValueAt(level, settingName, roomId = null, explicit = false, excludeDefault = false) {
        // Verify that the setting is actually a setting
        if (!SETTINGS[settingName]) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

        const setting = SETTINGS[settingName];
        const levelOrder = (setting.supportedLevelsAreOrdered ? setting.supportedLevels : LEVEL_ORDER);
        if (!levelOrder.includes("default")) levelOrder.push("default"); // always include default

        const minIndex = levelOrder.indexOf(level);
        if (minIndex === -1) throw new Error("Level " + level + " is not prioritized");

        if (SettingsStore.isFeature(settingName)) {
            const configValue = SettingsStore._getFeatureState(settingName);
            if (configValue === "enable") return true;
            if (configValue === "disable") return false;
            // else let it fall through the default process
        }

        const handlers = SettingsStore._getHandlers(settingName);

        if (explicit) {
            const handler = handlers[level];
            if (!handler) return SettingsStore._tryControllerOverride(settingName, level, roomId, null, null);
            const value = handler.getValue(settingName, roomId);
            return SettingsStore._tryControllerOverride(settingName, level, roomId, value, level);
        }

        for (let i = minIndex; i < levelOrder.length; i++) {
            const handler = handlers[levelOrder[i]];
            if (!handler) continue;
            if (excludeDefault && levelOrder[i] === "default") continue;

            const value = handler.getValue(settingName, roomId);
            if (value === null || value === undefined) continue;
            return SettingsStore._tryControllerOverride(settingName, level, roomId, value, levelOrder[i]);
        }

        return SettingsStore._tryControllerOverride(settingName, level, roomId, null, null);
    }

    static _tryControllerOverride(settingName, level, roomId, calculatedValue, calculatedAtLevel) {
        const controller = SETTINGS[settingName].controller;
        if (!controller) return calculatedValue;

        const actualValue = controller.getValueOverride(level, roomId, calculatedValue, calculatedAtLevel);
        if (actualValue !== undefined && actualValue !== null) return actualValue;
        return calculatedValue;
    }
    /* eslint-disable valid-jsdoc */
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
    /* eslint-enable valid-jsdoc */
    static async setValue(settingName, roomId, level, value) {
        // Verify that the setting is actually a setting
        if (!SETTINGS[settingName]) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

        const handler = SettingsStore._getHandler(settingName, level);
        if (!handler) {
            throw new Error("Setting " + settingName + " does not have a handler for " + level);
        }

        if (!handler.canSetValue(settingName, roomId)) {
            throw new Error("User cannot set " + settingName + " at " + level + " in " + roomId);
        }

        await handler.setValue(settingName, roomId, value);

        const controller = SETTINGS[settingName].controller;
        if (controller) {
            controller.onChange(level, roomId, value);
        }
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
        // Verify that the setting is actually a setting
        if (!SETTINGS[settingName]) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

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
        for (const level of SETTINGS[settingName].supportedLevels) {
            if (!LEVEL_HANDLERS[level]) throw new Error("Unexpected level " + level);
            handlers[level] = LEVEL_HANDLERS[level];
        }

        // Always support 'default'
        if (!handlers['default']) handlers['default'] = LEVEL_HANDLERS['default'];

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
        if (!allowedStates.includes(featureState)) {
            console.warn("Feature state '" + featureState + "' is invalid for " + settingName);
            featureState = "disable"; // to prevent accidental features.
        }

        return featureState;
    }
}

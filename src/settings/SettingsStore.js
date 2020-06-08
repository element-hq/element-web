/*
Copyright 2017 Travis Ralston
Copyright 2019 New Vector Ltd.

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
import dis from '../dispatcher/dispatcher';
import {SETTINGS} from "./Settings";
import LocalEchoWrapper from "./handlers/LocalEchoWrapper";
import {WatchManager} from "./WatchManager";

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

const defaultWatchManager = new WatchManager();

// Convert the settings to easier to manage objects for the handlers
const defaultSettings = {};
const invertedDefaultSettings = {};
const featureNames = [];
for (const key of Object.keys(SETTINGS)) {
    defaultSettings[key] = SETTINGS[key].default;
    if (SETTINGS[key].isFeature) featureNames.push(key);
    if (SETTINGS[key].invertedSettingName) {
        // Invert now so that the rest of the system will invert it back
        // to what was intended.
        invertedDefaultSettings[key] = !SETTINGS[key].default;
    }
}

const LEVEL_HANDLERS = {
    "device": new DeviceSettingsHandler(featureNames, defaultWatchManager),
    "room-device": new RoomDeviceSettingsHandler(defaultWatchManager),
    "room-account": new RoomAccountSettingsHandler(defaultWatchManager),
    "account": new AccountSettingsHandler(defaultWatchManager),
    "room": new RoomSettingsHandler(defaultWatchManager),
    "config": new ConfigSettingsHandler(),
    "default": new DefaultSettingsHandler(defaultSettings, invertedDefaultSettings),
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
    // We support watching settings for changes, and do this by tracking which callbacks have
    // been given to us. We end up returning the callbackRef to the caller so they can unsubscribe
    // at a later point.
    //
    // We also maintain a list of monitors which are special watchers: they cause dispatches
    // when the setting changes. We track which rooms we're monitoring though to ensure we
    // don't duplicate updates on the bus.
    static _watchers = {}; // { callbackRef => { callbackFn } }
    static _monitors = {}; // { settingName => { roomId => callbackRef } }

    // Counter used for generation of watcher IDs
    static _watcherCount = 1;

    /**
     * Watches for changes in a particular setting. This is done without any local echo
     * wrapping and fires whenever a change is detected in a setting's value, at any level.
     * Watching is intended to be used in scenarios where the app needs to react to changes
     * made by other devices. It is otherwise expected that callers will be able to use the
     * Controller system or track their own changes to settings. Callers should retain the
     * returned reference to later unsubscribe from updates.
     * @param {string} settingName The setting name to watch
     * @param {String} roomId The room ID to watch for changes in. May be null for 'all'.
     * @param {function} callbackFn A function to be called when a setting change is
     * detected. Five arguments can be expected: the setting name, the room ID (may be null),
     * the level the change happened at, the new value at the given level, and finally the new
     * value for the setting regardless of level. The callback is responsible for determining
     * if the change in value is worthwhile enough to react upon.
     * @returns {string} A reference to the watcher that was employed.
     */
    static watchSetting(settingName, roomId, callbackFn) {
        const setting = SETTINGS[settingName];
        const originalSettingName = settingName;
        if (!setting) throw new Error(`${settingName} is not a setting`);

        if (setting.invertedSettingName) {
            settingName = setting.invertedSettingName;
        }

        const watcherId = `${new Date().getTime()}_${SettingsStore._watcherCount++}_${settingName}_${roomId}`;

        const localizedCallback = (changedInRoomId, atLevel, newValAtLevel) => {
            const newValue = SettingsStore.getValue(originalSettingName);
            callbackFn(originalSettingName, changedInRoomId, atLevel, newValAtLevel, newValue);
        };

        console.log(`Starting watcher for ${settingName}@${roomId || '<null room>'} as ID ${watcherId}`);
        SettingsStore._watchers[watcherId] = localizedCallback;
        defaultWatchManager.watchSetting(settingName, roomId, localizedCallback);

        return watcherId;
    }

    /**
     * Stops the SettingsStore from watching a setting. This is a no-op if the watcher
     * provided is not found.
     * @param {string} watcherReference The watcher reference (received from #watchSetting)
     * to cancel.
     */
    static unwatchSetting(watcherReference) {
        if (!SettingsStore._watchers[watcherReference]) {
            console.warn(`Ending non-existent watcher ID ${watcherReference}`);
            return;
        }

        console.log(`Ending watcher ID ${watcherReference}`);
        defaultWatchManager.unwatchSetting(SettingsStore._watchers[watcherReference]);
        delete SettingsStore._watchers[watcherReference];
    }

    /**
     * Sets up a monitor for a setting. This behaves similar to #watchSetting except instead
     * of making a call to a callback, it forwards all changes to the dispatcher. Callers can
     * expect to listen for the 'setting_updated' action with an object containing settingName,
     * roomId, level, newValueAtLevel, and newValue.
     * @param {string} settingName The setting name to monitor.
     * @param {String} roomId The room ID to monitor for changes in. Use null for all rooms.
     */
    static monitorSetting(settingName, roomId) {
        roomId = roomId || null; // the thing wants null specifically to work, so appease it.

        if (!this._monitors[settingName]) this._monitors[settingName] = {};

        const registerWatcher = () => {
            this._monitors[settingName][roomId] = SettingsStore.watchSetting(
                settingName, roomId, (settingName, inRoomId, level, newValueAtLevel, newValue) => {
                    dis.dispatch({
                        action: 'setting_updated',
                        settingName,
                        roomId: inRoomId,
                        level,
                        newValueAtLevel,
                        newValue,
                    });
                },
            );
        };

        const hasRoom = Object.keys(this._monitors[settingName]).find((r) => r === roomId || r === null);
        if (!hasRoom) {
            registerWatcher();
        } else {
            if (roomId === null) {
                // Unregister all existing watchers and register the new one
                for (const roomId of Object.keys(this._monitors[settingName])) {
                    SettingsStore.unwatchSetting(this._monitors[settingName][roomId]);
                }
                this._monitors[settingName] = {};
                registerWatcher();
            } // else a watcher is already registered for the room, so don't bother registering it again
        }
    }

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
        const setting = SETTINGS[settingName];
        if (!setting) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

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

        // Check if we need to invert the setting at all. Do this after we get the setting
        // handlers though, otherwise we'll fail to read the value.
        if (setting.invertedSettingName) {
            //console.warn(`Inverting ${settingName} to be ${setting.invertedSettingName} - legacy setting`);
            settingName = setting.invertedSettingName;
        }

        if (explicit) {
            const handler = handlers[level];
            if (!handler) {
                return SettingsStore._getFinalValue(setting, level, roomId, null, null);
            }
            const value = handler.getValue(settingName, roomId);
            return SettingsStore._getFinalValue(setting, level, roomId, value, level);
        }

        for (let i = minIndex; i < levelOrder.length; i++) {
            const handler = handlers[levelOrder[i]];
            if (!handler) continue;
            if (excludeDefault && levelOrder[i] === "default") continue;

            const value = handler.getValue(settingName, roomId);
            if (value === null || value === undefined) continue;
            return SettingsStore._getFinalValue(setting, level, roomId, value, levelOrder[i]);
        }

        return SettingsStore._getFinalValue(setting, level, roomId, null, null);
    }

    /**
     * Gets the default value of a setting.
     * @param {string} settingName The name of the setting to read the value of.
     * @param {String} roomId The room ID to read the setting value in, may be null.
     * @return {*} The default value
     */
    static getDefaultValue(settingName) {
        // Verify that the setting is actually a setting
        if (!SETTINGS[settingName]) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

        return SETTINGS[settingName].default;
    }

    static _getFinalValue(setting, level, roomId, calculatedValue, calculatedAtLevel) {
        let resultingValue = calculatedValue;

        if (setting.controller) {
            const actualValue = setting.controller.getValueOverride(level, roomId, calculatedValue, calculatedAtLevel);
            if (actualValue !== undefined && actualValue !== null) resultingValue = actualValue;
        }

        if (setting.invertedSettingName) resultingValue = !resultingValue;
        return resultingValue;
    }

    /* eslint-disable valid-jsdoc */ //https://github.com/eslint/eslint/issues/7307
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
        const setting = SETTINGS[settingName];
        if (!setting) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

        const handler = SettingsStore._getHandler(settingName, level);
        if (!handler) {
            throw new Error("Setting " + settingName + " does not have a handler for " + level);
        }

        if (setting.invertedSettingName) {
            // Note: We can't do this when the `level` is "default", however we also
            // know that the user can't possible change the default value through this
            // function so we don't bother checking it.
            //console.warn(`Inverting ${settingName} to be ${setting.invertedSettingName} - legacy setting`);
            settingName = setting.invertedSettingName;
            value = !value;
        }

        if (!handler.canSetValue(settingName, roomId)) {
            throw new Error("User cannot set " + settingName + " at " + level + " in " + roomId);
        }

        await handler.setValue(settingName, roomId, value);

        const controller = setting.controller;
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

    /**
     * Debugging function for reading explicit setting values without going through the
     * complicated/biased functions in the SettingsStore. This will print information to
     * the console for analysis. Not intended to be used within the application.
     * @param {string} realSettingName The setting name to try and read.
     * @param {string} roomId Optional room ID to test the setting in.
     */
    static debugSetting(realSettingName, roomId) {
        console.log(`--- DEBUG ${realSettingName}`);

        // Note: we intentionally use JSON.stringify here to avoid the console masking the
        // problem if there's a type representation issue. Also, this way it is guaranteed
        // to show up in a rageshake if required.

        const def = SETTINGS[realSettingName];
        console.log(`--- definition: ${def ? JSON.stringify(def) : '<NOT_FOUND>'}`);
        console.log(`--- default level order: ${JSON.stringify(LEVEL_ORDER)}`);
        console.log(`--- registered handlers: ${JSON.stringify(Object.keys(LEVEL_HANDLERS))}`);

        const doChecks = (settingName) => {
            for (const handlerName of Object.keys(LEVEL_HANDLERS)) {
                const handler = LEVEL_HANDLERS[handlerName];

                try {
                    const value = handler.getValue(settingName, roomId);
                    console.log(`---     ${handlerName}@${roomId || '<no_room>'} = ${JSON.stringify(value)}`);
                } catch (e) {
                    console.log(`---     ${handler}@${roomId || '<no_room>'} THREW ERROR: ${e.message}`);
                    console.error(e);
                }

                if (roomId) {
                    try {
                        const value = handler.getValue(settingName, null);
                        console.log(`---     ${handlerName}@<no_room> = ${JSON.stringify(value)}`);
                    } catch (e) {
                        console.log(`---     ${handler}@<no_room> THREW ERROR: ${e.message}`);
                        console.error(e);
                    }
                }
            }

            console.log(`--- calculating as returned by SettingsStore`);
            console.log(`--- these might not match if the setting uses a controller - be warned!`);

            try {
                const value = SettingsStore.getValue(settingName, roomId);
                console.log(`---     SettingsStore#generic@${roomId || '<no_room>'}  = ${JSON.stringify(value)}`);
            } catch (e) {
                console.log(`---     SettingsStore#generic@${roomId || '<no_room>'} THREW ERROR: ${e.message}`);
                console.error(e);
            }

            if (roomId) {
                try {
                    const value = SettingsStore.getValue(settingName, null);
                    console.log(`---     SettingsStore#generic@<no_room>  = ${JSON.stringify(value)}`);
                } catch (e) {
                    console.log(`---     SettingsStore#generic@$<no_room> THREW ERROR: ${e.message}`);
                    console.error(e);
                }
            }

            for (const level of LEVEL_ORDER) {
                try {
                    const value = SettingsStore.getValueAt(level, settingName, roomId);
                    console.log(`---     SettingsStore#${level}@${roomId || '<no_room>'} = ${JSON.stringify(value)}`);
                } catch (e) {
                    console.log(`---     SettingsStore#${level}@${roomId || '<no_room>'} THREW ERROR: ${e.message}`);
                    console.error(e);
                }

                if (roomId) {
                    try {
                        const value = SettingsStore.getValueAt(level, settingName, null);
                        console.log(`---     SettingsStore#${level}@<no_room> = ${JSON.stringify(value)}`);
                    } catch (e) {
                        console.log(`---     SettingsStore#${level}@$<no_room> THREW ERROR: ${e.message}`);
                        console.error(e);
                    }
                }
            }
        };

        doChecks(realSettingName);

        if (def.invertedSettingName) {
            console.log(`--- TESTING INVERTED SETTING NAME`);
            console.log(`--- inverted: ${def.invertedSettingName}`);
            doChecks(def.invertedSettingName);
        }

        console.log(`--- END DEBUG`);
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
            if (SettingsStore.isLevelSupported(level)) handlers[level] = LEVEL_HANDLERS[level];
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

// For debugging purposes
global.mxSettingsStore = SettingsStore;

/*
Copyright 2017 Travis Ralston
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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
import { _t } from '../languageHandler';
import dis from '../dispatcher/dispatcher';
import { ISetting, SETTINGS } from "./Settings";
import LocalEchoWrapper from "./handlers/LocalEchoWrapper";
import { WatchManager } from "./WatchManager";
import { SettingLevel } from "./SettingLevel";
import SettingsHandler from "./handlers/SettingsHandler";

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
        invertedDefaultSettings[SETTINGS[key].invertedSettingName] = !SETTINGS[key].default;
    }
}

const LEVEL_HANDLERS = {
    [SettingLevel.DEVICE]: new DeviceSettingsHandler(featureNames, defaultWatchManager),
    [SettingLevel.ROOM_DEVICE]: new RoomDeviceSettingsHandler(defaultWatchManager),
    [SettingLevel.ROOM_ACCOUNT]: new RoomAccountSettingsHandler(defaultWatchManager),
    [SettingLevel.ACCOUNT]: new AccountSettingsHandler(defaultWatchManager),
    [SettingLevel.ROOM]: new RoomSettingsHandler(defaultWatchManager),
    [SettingLevel.CONFIG]: new ConfigSettingsHandler(featureNames),
    [SettingLevel.DEFAULT]: new DefaultSettingsHandler(defaultSettings, invertedDefaultSettings),
};

// Wrap all the handlers with local echo
for (const key of Object.keys(LEVEL_HANDLERS)) {
    LEVEL_HANDLERS[key] = new LocalEchoWrapper(LEVEL_HANDLERS[key]);
}

const LEVEL_ORDER = [
    SettingLevel.DEVICE,
    SettingLevel.ROOM_DEVICE,
    SettingLevel.ROOM_ACCOUNT,
    SettingLevel.ACCOUNT,
    SettingLevel.ROOM,
    SettingLevel.CONFIG,
    SettingLevel.DEFAULT,
];

export type CallbackFn = (
    settingName: string,
    roomId: string,
    atLevel: SettingLevel,
    newValAtLevel: any,
    newVal: any,
) => void;

interface IHandlerMap {
    // @ts-ignore - TS wants this to be a string key but we know better
    [level: SettingLevel]: SettingsHandler;
}

export type LabsFeatureState = "labs" | "disable" | "enable" | string;

/**
 * Controls and manages application settings by providing varying levels at which the
 * setting value may be specified. The levels are then used to determine what the setting
 * value should be given a set of circumstances. The levels, in priority order, are:
 * - SettingLevel.DEVICE         - Values are determined by the current device
 * - SettingLevel.ROOM_DEVICE    - Values are determined by the current device for a particular room
 * - SettingLevel.ROOM_ACCOUNT   - Values are determined by the current account for a particular room
 * - SettingLevel.ACCOUNT        - Values are determined by the current account
 * - SettingLevel.ROOM           - Values are determined by a particular room (by the room admins)
 * - SettingLevel.CONFIG         - Values are determined by the config.json
 * - SettingLevel.DEFAULT        - Values are determined by the hardcoded defaults
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
    private static watchers = {}; // { callbackRef => { callbackFn } }
    private static monitors = {}; // { settingName => { roomId => callbackRef } }

    // Counter used for generation of watcher IDs
    private static watcherCount = 1;

    /**
     * Gets all the feature-style setting names.
     * @returns {string[]} The names of the feature settings.
     */
    public static getFeatureSettingNames(): string[] {
        return Object.keys(SETTINGS).filter(n => SettingsStore.isFeature(n));
    }

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
    public static watchSetting(settingName: string, roomId: string, callbackFn: CallbackFn): string {
        const setting = SETTINGS[settingName];
        const originalSettingName = settingName;
        if (!setting) throw new Error(`${settingName} is not a setting`);

        if (setting.invertedSettingName) {
            settingName = setting.invertedSettingName;
        }

        const watcherId = `${new Date().getTime()}_${SettingsStore.watcherCount++}_${settingName}_${roomId}`;

        const localizedCallback = (changedInRoomId, atLevel, newValAtLevel) => {
            const newValue = SettingsStore.getValue(originalSettingName);
            callbackFn(originalSettingName, changedInRoomId, atLevel, newValAtLevel, newValue);
        };

        SettingsStore.watchers[watcherId] = localizedCallback;
        defaultWatchManager.watchSetting(settingName, roomId, localizedCallback);

        return watcherId;
    }

    /**
     * Stops the SettingsStore from watching a setting. This is a no-op if the watcher
     * provided is not found.
     * @param {string} watcherReference The watcher reference (received from #watchSetting)
     * to cancel.
     */
    public static unwatchSetting(watcherReference: string) {
        if (!SettingsStore.watchers[watcherReference]) {
            console.warn(`Ending non-existent watcher ID ${watcherReference}`);
            return;
        }

        defaultWatchManager.unwatchSetting(SettingsStore.watchers[watcherReference]);
        delete SettingsStore.watchers[watcherReference];
    }

    /**
     * Sets up a monitor for a setting. This behaves similar to #watchSetting except instead
     * of making a call to a callback, it forwards all changes to the dispatcher. Callers can
     * expect to listen for the 'setting_updated' action with an object containing settingName,
     * roomId, level, newValueAtLevel, and newValue.
     * @param {string} settingName The setting name to monitor.
     * @param {String} roomId The room ID to monitor for changes in. Use null for all rooms.
     */
    public static monitorSetting(settingName: string, roomId: string) {
        roomId = roomId || null; // the thing wants null specifically to work, so appease it.

        if (!this.monitors[settingName]) this.monitors[settingName] = {};

        const registerWatcher = () => {
            this.monitors[settingName][roomId] = SettingsStore.watchSetting(
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

        const hasRoom = Object.keys(this.monitors[settingName]).find((r) => r === roomId || r === null);
        if (!hasRoom) {
            registerWatcher();
        } else {
            if (roomId === null) {
                // Unregister all existing watchers and register the new one
                for (const roomId of Object.keys(this.monitors[settingName])) {
                    SettingsStore.unwatchSetting(this.monitors[settingName][roomId]);
                }
                this.monitors[settingName] = {};
                registerWatcher();
            } // else a watcher is already registered for the room, so don't bother registering it again
        }
    }

    /**
     * Gets the translated display name for a given setting
     * @param {string} settingName The setting to look up.
     * @param {SettingLevel} atLevel
     * The level to get the display name for; Defaults to 'default'.
     * @return {String} The display name for the setting, or null if not found.
     */
    public static getDisplayName(settingName: string, atLevel = SettingLevel.DEFAULT) {
        if (!SETTINGS[settingName] || !SETTINGS[settingName].displayName) return null;

        let displayName = SETTINGS[settingName].displayName;
        if (displayName instanceof Object) {
            if (displayName[atLevel]) displayName = displayName[atLevel];
            else displayName = displayName["default"];
        }

        return _t(displayName as string);
    }

    /**
     * Determines if a setting is also a feature.
     * @param {string} settingName The setting to look up.
     * @return {boolean} True if the setting is a feature.
     */
    public static isFeature(settingName: string) {
        if (!SETTINGS[settingName]) return false;
        return SETTINGS[settingName].isFeature;
    }

    /**
     * Determines if a setting is enabled.
     * If a setting is disabled then it should be hidden from the user.
     * @param {string} settingName The setting to look up.
     * @return {boolean} True if the setting is enabled.
     */
    public static isEnabled(settingName: string): boolean {
        if (!SETTINGS[settingName]) return false;
        return SETTINGS[settingName].controller ? !SETTINGS[settingName].controller.settingDisabled : true;
    }

    /**
     * Gets the value of a setting. The room ID is optional if the setting is not to
     * be applied to any particular room, otherwise it should be supplied.
     * @param {string} settingName The name of the setting to read the value of.
     * @param {String} roomId The room ID to read the setting value in, may be null.
     * @param {boolean} excludeDefault True to disable using the default value.
     * @return {*} The value, or null if not found
     */
    public static getValue(settingName: string, roomId: string = null, excludeDefault = false): any {
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
     * @param {SettingLevel|"config"|"default"} level The
     * level to look at.
     * @param {string} settingName The name of the setting to read.
     * @param {String} roomId The room ID to read the setting value in, may be null.
     * @param {boolean} explicit If true, this method will not consider other levels, just the one
     * provided. Defaults to false.
     * @param {boolean} excludeDefault True to disable using the default value.
     * @return {*} The value, or null if not found.
     */
    public static getValueAt(
        level: SettingLevel,
        settingName: string,
        roomId: string = null,
        explicit = false,
        excludeDefault = false,
    ): any {
        // Verify that the setting is actually a setting
        const setting = SETTINGS[settingName];
        if (!setting) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

        const levelOrder = (setting.supportedLevelsAreOrdered ? setting.supportedLevels : LEVEL_ORDER);
        if (!levelOrder.includes(SettingLevel.DEFAULT)) levelOrder.push(SettingLevel.DEFAULT); // always include default

        const minIndex = levelOrder.indexOf(level);
        if (minIndex === -1) throw new Error("Level " + level + " is not prioritized");

        const handlers = SettingsStore.getHandlers(settingName);

        // Check if we need to invert the setting at all. Do this after we get the setting
        // handlers though, otherwise we'll fail to read the value.
        if (setting.invertedSettingName) {
            //console.warn(`Inverting ${settingName} to be ${setting.invertedSettingName} - legacy setting`);
            settingName = setting.invertedSettingName;
        }

        if (explicit) {
            const handler = handlers[level];
            if (!handler) {
                return SettingsStore.getFinalValue(setting, level, roomId, null, null);
            }
            const value = handler.getValue(settingName, roomId);
            return SettingsStore.getFinalValue(setting, level, roomId, value, level);
        }

        for (let i = minIndex; i < levelOrder.length; i++) {
            const handler = handlers[levelOrder[i]];
            if (!handler) continue;
            if (excludeDefault && levelOrder[i] === "default") continue;

            const value = handler.getValue(settingName, roomId);
            if (value === null || value === undefined) continue;
            return SettingsStore.getFinalValue(setting, level, roomId, value, levelOrder[i]);
        }

        return SettingsStore.getFinalValue(setting, level, roomId, null, null);
    }

    /**
     * Gets the default value of a setting.
     * @param {string} settingName The name of the setting to read the value of.
     * @param {String} roomId The room ID to read the setting value in, may be null.
     * @return {*} The default value
     */
    public static getDefaultValue(settingName: string): any {
        // Verify that the setting is actually a setting
        if (!SETTINGS[settingName]) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

        return SETTINGS[settingName].default;
    }

    private static getFinalValue(
        setting: ISetting,
        level: SettingLevel,
        roomId: string,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel,
    ): any {
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
     * @param {SettingLevel} level The level
     * to change the value at.
     * @param {*} value The new value of the setting, may be null.
     * @return {Promise} Resolves when the setting has been changed.
     */

    /* eslint-enable valid-jsdoc */
    public static async setValue(settingName: string, roomId: string, level: SettingLevel, value: any): Promise<void> {
        // Verify that the setting is actually a setting
        const setting = SETTINGS[settingName];
        if (!setting) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

        const handler = SettingsStore.getHandler(settingName, level);
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
     * @param {SettingLevel} level The level to
     * check at.
     * @return {boolean} True if the user may set the setting, false otherwise.
     */
    public static canSetValue(settingName: string, roomId: string, level: SettingLevel): boolean {
        // Verify that the setting is actually a setting
        if (!SETTINGS[settingName]) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

        // When features are specified in the config.json, we force them as enabled or disabled.
        if (SettingsStore.isFeature(settingName)) {
            const configVal = SettingsStore.getValueAt(SettingLevel.CONFIG, settingName, roomId, true, true);
            if (configVal === true || configVal === false) return false;
        }

        const handler = SettingsStore.getHandler(settingName, level);
        if (!handler) return false;
        return handler.canSetValue(settingName, roomId);
    }

    /**
     * Determines if the given level is supported on this device.
     * @param {SettingLevel} level The level
     * to check the feasibility of.
     * @return {boolean} True if the level is supported, false otherwise.
     */
    public static isLevelSupported(level: SettingLevel): boolean {
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
    public static debugSetting(realSettingName: string, roomId: string) {
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

    private static getHandler(settingName: string, level: SettingLevel): SettingsHandler {
        const handlers = SettingsStore.getHandlers(settingName);
        if (!handlers[level]) return null;
        return handlers[level];
    }

    private static getHandlers(settingName: string): IHandlerMap {
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
}

// For debugging purposes
window.mxSettingsStore = SettingsStore;

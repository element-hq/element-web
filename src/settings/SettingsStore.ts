/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2017 Travis Ralston

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { type ReactNode } from "react";
import { ClientEvent, SyncState } from "matrix-js-sdk/src/matrix";

import DeviceSettingsHandler from "./handlers/DeviceSettingsHandler";
import RoomDeviceSettingsHandler from "./handlers/RoomDeviceSettingsHandler";
import DefaultSettingsHandler from "./handlers/DefaultSettingsHandler";
import RoomAccountSettingsHandler from "./handlers/RoomAccountSettingsHandler";
import AccountSettingsHandler from "./handlers/AccountSettingsHandler";
import RoomSettingsHandler from "./handlers/RoomSettingsHandler";
import ConfigSettingsHandler from "./handlers/ConfigSettingsHandler";
import { _t } from "../languageHandler";
import dis from "../dispatcher/dispatcher";
import {
    type IFeature,
    type ISetting,
    type LabGroup,
    SETTINGS,
    defaultWatchManager,
    type SettingKey,
    type Settings,
} from "./Settings";
import LocalEchoWrapper from "./handlers/LocalEchoWrapper";
import { type CallbackFn as WatchCallbackFn } from "./WatchManager";
import { SettingLevel } from "./SettingLevel";
import type SettingsHandler from "./handlers/SettingsHandler";
import { type SettingUpdatedPayload } from "../dispatcher/payloads/SettingUpdatedPayload";
import { Action } from "../dispatcher/actions";
import PlatformSettingsHandler from "./handlers/PlatformSettingsHandler";
import ReloadOnChangeController from "./controllers/ReloadOnChangeController";
import { MatrixClientPeg } from "../MatrixClientPeg";

// Convert the settings to easier to manage objects for the handlers
const defaultSettings: Record<string, any> = {};
const invertedDefaultSettings: Record<string, boolean> = {};
const featureNames: SettingKey[] = [];
for (const key in SETTINGS) {
    const setting = SETTINGS[key as SettingKey];
    defaultSettings[key] = setting.default;
    if (setting.isFeature) featureNames.push(key as SettingKey);
    if (setting.invertedSettingName) {
        // Invert now so that the rest of the system will invert it back to what was intended.
        invertedDefaultSettings[setting.invertedSettingName] = !setting.default;
    }
}

// Only wrap the handlers with async setters in a local echo wrapper
const LEVEL_HANDLERS: Record<SettingLevel, SettingsHandler> = {
    [SettingLevel.DEVICE]: new DeviceSettingsHandler(featureNames, defaultWatchManager),
    [SettingLevel.ROOM_DEVICE]: new RoomDeviceSettingsHandler(defaultWatchManager),
    [SettingLevel.ROOM_ACCOUNT]: new LocalEchoWrapper(
        new RoomAccountSettingsHandler(defaultWatchManager),
        SettingLevel.ROOM_ACCOUNT,
    ),
    [SettingLevel.ACCOUNT]: new LocalEchoWrapper(new AccountSettingsHandler(defaultWatchManager), SettingLevel.ACCOUNT),
    [SettingLevel.ROOM]: new LocalEchoWrapper(new RoomSettingsHandler(defaultWatchManager), SettingLevel.ROOM),
    [SettingLevel.PLATFORM]: new LocalEchoWrapper(new PlatformSettingsHandler(), SettingLevel.PLATFORM),
    [SettingLevel.CONFIG]: new ConfigSettingsHandler(featureNames),
    [SettingLevel.DEFAULT]: new DefaultSettingsHandler(defaultSettings, invertedDefaultSettings),
};

export const LEVEL_ORDER = [
    SettingLevel.DEVICE,
    SettingLevel.ROOM_DEVICE,
    SettingLevel.ROOM_ACCOUNT,
    SettingLevel.ACCOUNT,
    SettingLevel.ROOM,
    SettingLevel.CONFIG,
    SettingLevel.DEFAULT,
];

function getLevelOrder(setting: ISetting): SettingLevel[] {
    // Settings which support only a single setting level are inherently ordered
    if (setting.supportedLevelsAreOrdered || setting.supportedLevels.length === 1) {
        // return a copy to prevent callers from modifying the array
        return [...setting.supportedLevels];
    }
    return LEVEL_ORDER;
}

export type CallbackFn = (
    settingName: SettingKey,
    roomId: string | null,
    atLevel: SettingLevel,
    newValAtLevel: any,
    newVal: any,
) => void;

type HandlerMap = Partial<{
    [level in SettingLevel]: SettingsHandler;
}>;

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
    private static watchers = new Map<string, WatchCallbackFn>();
    private static monitors = new Map<string, Map<string | null, string>>(); // { settingName => { roomId => callbackRef } }

    // Counter used for generation of watcher IDs
    private static watcherCount = 1;

    public static reset(): void {
        for (const handler of Object.values(LEVEL_HANDLERS)) {
            handler.reset();
        }
    }

    /**
     * Gets all the feature-style setting names.
     * @returns {string[]} The names of the feature settings.
     */
    public static getFeatureSettingNames(): SettingKey[] {
        return (Object.keys(SETTINGS) as SettingKey[]).filter((n) => SettingsStore.isFeature(n));
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
    public static watchSetting(settingName: SettingKey, roomId: string | null, callbackFn: CallbackFn): string {
        const setting = SETTINGS[settingName];
        if (!setting) throw new Error(`${settingName} is not a setting`);

        const finalSettingName: string = setting.invertedSettingName ?? settingName;

        const watcherId = `${new Date().getTime()}_${SettingsStore.watcherCount++}_${finalSettingName}_${roomId}`;

        const localizedCallback = (changedInRoomId: string | null, atLevel: SettingLevel, newValAtLevel: any): void => {
            if (!SettingsStore.doesSettingSupportLevel(settingName, atLevel)) {
                logger.warn(
                    `Setting handler notified for an update of an invalid setting level: ` +
                        `${settingName}@${atLevel} - this likely means a weird setting value ` +
                        `made it into the level's storage. The notification will be ignored.`,
                );
                return;
            }
            const newValue = SettingsStore.getValue(settingName);
            const newValueAtLevel = SettingsStore.getValueAt(atLevel, settingName) ?? newValAtLevel;
            callbackFn(settingName, changedInRoomId, atLevel, newValueAtLevel, newValue);
        };

        SettingsStore.watchers.set(watcherId, localizedCallback);
        defaultWatchManager.watchSetting(finalSettingName, roomId, localizedCallback);

        return watcherId;
    }

    /**
     * Stops the SettingsStore from watching a setting. This is a no-op if the watcher
     * provided is not found.
     * @param watcherReference The watcher reference (received from #watchSetting) to cancel.
     * Can be undefined to avoid needing an if around every caller.
     */
    public static unwatchSetting(watcherReference: string | undefined): void {
        if (!watcherReference) return;
        if (!SettingsStore.watchers.has(watcherReference)) {
            logger.warn(`Ending non-existent watcher ID ${watcherReference}`);
            return;
        }

        defaultWatchManager.unwatchSetting(SettingsStore.watchers.get(watcherReference)!);
        SettingsStore.watchers.delete(watcherReference);
    }

    /**
     * Sets up a monitor for a setting. This behaves similar to #watchSetting except instead
     * of making a call to a callback, it forwards all changes to the dispatcher. Callers can
     * expect to listen for the 'setting_updated' action with an object containing settingName,
     * roomId, level, newValueAtLevel, and newValue.
     * @param {string} settingName The setting name to monitor.
     * @param {String} roomId The room ID to monitor for changes in. Use null for all rooms.
     */
    public static monitorSetting(settingName: SettingKey, roomId: string | null): void {
        roomId = roomId || null; // the thing wants null specifically to work, so appease it.

        if (!this.monitors.has(settingName)) this.monitors.set(settingName, new Map());

        const registerWatcher = (): void => {
            this.monitors.get(settingName)!.set(
                roomId,
                SettingsStore.watchSetting(
                    settingName,
                    roomId,
                    (settingName, inRoomId, level, newValueAtLevel, newValue) => {
                        dis.dispatch<SettingUpdatedPayload>({
                            action: Action.SettingUpdated,
                            settingName,
                            roomId: inRoomId,
                            level,
                            newValueAtLevel,
                            newValue,
                        });
                    },
                ),
            );
        };

        const rooms = Array.from(this.monitors.get(settingName)!.keys());
        const hasRoom = rooms.find((r) => r === roomId || r === null);
        if (!hasRoom) {
            registerWatcher();
        } else {
            if (roomId === null) {
                // Unregister all existing watchers and register the new one
                rooms.forEach((roomId) => {
                    SettingsStore.unwatchSetting(this.monitors.get(settingName)!.get(roomId)!);
                });
                this.monitors.get(settingName)!.clear();
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
    public static getDisplayName(settingName: SettingKey, atLevel = SettingLevel.DEFAULT): string | null {
        if (!SETTINGS[settingName] || !SETTINGS[settingName].displayName) return null;

        const displayName = SETTINGS[settingName].displayName;

        if (typeof displayName === "string") {
            return _t(displayName);
        }
        if (displayName?.[atLevel]) {
            return _t(displayName[atLevel]);
        }
        if (displayName?.["default"]) {
            return _t(displayName["default"]);
        }

        return null;
    }

    /**
     * Gets the translated description for a given setting
     * @param {string} settingName The setting to look up.
     * @return {String} The description for the setting, or null if not found.
     */
    public static getDescription(settingName: SettingKey): string | ReactNode {
        const description = SETTINGS[settingName]?.description;
        if (!description) return null;
        if (typeof description !== "string") return description();
        return _t(description);
    }

    /**
     * Determines if a setting is also a feature.
     * @param {string} settingName The setting to look up.
     * @return {boolean} True if the setting is a feature.
     */
    public static isFeature(settingName: SettingKey): boolean {
        if (!SETTINGS[settingName]) return false;
        return !!SETTINGS[settingName].isFeature;
    }

    /**
     * Determines if a setting should have a warning sign in the microcopy
     * @param {string} settingName The setting to look up.
     * @return {boolean} True if the setting should have a warning sign.
     */
    public static shouldHaveWarning(settingName: SettingKey): boolean {
        if (!SETTINGS[settingName]) return false;
        return SETTINGS[settingName].shouldWarn ?? false;
    }

    public static getBetaInfo(settingName: SettingKey): ISetting["betaInfo"] {
        // consider a beta disabled if the config is explicitly set to false, in which case treat as normal Labs flag
        if (
            SettingsStore.isFeature(settingName) &&
            SettingsStore.getValueAt(SettingLevel.CONFIG, settingName, null, true, true) !== false
        ) {
            const betaInfo = SETTINGS[settingName]!.betaInfo;
            if (betaInfo) {
                betaInfo.requiresRefresh =
                    betaInfo.requiresRefresh ?? SETTINGS[settingName]!.controller instanceof ReloadOnChangeController;
            }
            return betaInfo;
        }
    }

    public static getLabGroup(settingName: SettingKey): LabGroup | undefined {
        if (SettingsStore.isFeature(settingName)) {
            return (<IFeature>SETTINGS[settingName]).labsGroup;
        }
    }

    /**
     * Retrieves the reason a setting is disabled if one is assigned.
     * If a setting is not disabled, or no reason is given by the `SettingController`,
     * this will return undefined.
     * @param {string} settingName The setting to look up.
     * @return {string} The reason the setting is disabled.
     */
    public static disabledMessage(settingName: SettingKey): string | undefined {
        const disabled = SETTINGS[settingName].controller?.settingDisabled;
        return typeof disabled === "string" ? disabled : undefined;
    }

    /**
     * Gets the value of a setting. The room ID is optional if the setting is not to
     * be applied to any particular room, otherwise it should be supplied.
     * @param {string} settingName The name of the setting to read the value of.
     * @param {String} roomId The room ID to read the setting value in, may be null.
     * @param {boolean} excludeDefault True to disable using the default value.
     * @return {*} The value, or null if not found
     */
    public static getValue<S extends SettingKey>(
        settingName: S,
        roomId: string | null,
        excludeDefault: true,
    ): Settings[S]["default"] | undefined;
    public static getValue<S extends SettingKey>(
        settingName: S,
        roomId?: string | null,
        excludeDefault?: false,
    ): Settings[S]["default"];
    public static getValue<S extends SettingKey>(
        settingName: S,
        roomId: string | null = null,
        excludeDefault = false,
    ): Settings[S]["default"] | undefined {
        // Verify that the setting is actually a setting
        if (!SETTINGS[settingName]) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

        const setting = SETTINGS[settingName];
        const levelOrder = getLevelOrder(setting);

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
    public static getValueAt<S extends SettingKey>(
        level: SettingLevel,
        settingName: S,
        roomId: string | null = null,
        explicit = false,
        excludeDefault = false,
    ): Settings[S]["default"] {
        // Verify that the setting is actually a setting
        const setting = SETTINGS[settingName];
        if (!setting) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

        const levelOrder = getLevelOrder(setting);
        if (!levelOrder.includes(SettingLevel.DEFAULT)) levelOrder.push(SettingLevel.DEFAULT); // always include default

        const minIndex = levelOrder.indexOf(level);
        if (minIndex === -1) throw new Error(`Level "${level}" for setting "${settingName}" is not prioritized`);

        const handlers = SettingsStore.getHandlers(settingName);

        // Check if we need to invert the setting at all. Do this after we get the setting
        // handlers though, otherwise we'll fail to read the value.
        let finalSettingName: string = settingName;
        if (setting.invertedSettingName) {
            //console.warn(`Inverting ${settingName} to be ${setting.invertedSettingName} - legacy setting`);
            finalSettingName = setting.invertedSettingName;
        }

        if (explicit) {
            const handler = handlers[level];
            if (!handler) {
                return SettingsStore.getFinalValue(setting, level, roomId, null, null);
            }
            const value = handler.getValue(finalSettingName, roomId);
            return SettingsStore.getFinalValue(setting, level, roomId, value, level);
        }

        for (let i = minIndex; i < levelOrder.length; i++) {
            const handler = handlers[levelOrder[i]];
            if (!handler) continue;
            if (excludeDefault && levelOrder[i] === "default") continue;

            const value = handler.getValue(finalSettingName, roomId);
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
    public static getDefaultValue(settingName: SettingKey): any {
        // Verify that the setting is actually a setting
        if (!SETTINGS[settingName]) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

        return SETTINGS[settingName].default;
    }

    private static getFinalValue(
        setting: ISetting,
        level: SettingLevel,
        roomId: string | null,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel | null,
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
    public static async setValue(
        settingName: SettingKey,
        roomId: string | null,
        level: SettingLevel,
        value: any,
    ): Promise<void> {
        // Verify that the setting is actually a setting
        const setting = SETTINGS[settingName];
        if (!setting) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

        const handler = SettingsStore.getHandler(settingName, level);
        if (!handler) {
            throw new Error("Setting " + settingName + " does not have a handler for " + level);
        }

        let finalSettingName: string = settingName;
        if (setting.invertedSettingName) {
            // Note: We can't do this when the `level` is "default", however we also
            // know that the user can't possible change the default value through this
            // function so we don't bother checking it.
            //console.warn(`Inverting ${settingName} to be ${setting.invertedSettingName} - legacy setting`);
            finalSettingName = setting.invertedSettingName;
            value = !value;
        }

        if (!handler.canSetValue(finalSettingName, roomId)) {
            throw new Error("User cannot set " + finalSettingName + " at " + level + " in " + roomId);
        }

        if (setting.controller && !(await setting.controller.beforeChange(level, roomId, value))) {
            return; // controller says no
        }

        await handler.setValue(finalSettingName, roomId, value);

        setting.controller?.onChange(level, roomId, value);
    }

    /**
     * Determines if the current user is permitted to set the given setting at the given
     * level for a particular room. The room ID is optional if the setting is not being
     * set for a particular room, otherwise it should be supplied.
     *
     * This takes into account both the value of {@link SettingController#settingDisabled} of the
     * `SettingController`, if any; and, for settings where {@link IBaseSetting#supportedLevelsAreOrdered} is true,
     * checks whether a level of higher precedence is set.
     *
     * Typically, if the user cannot set the setting, it should be hidden, to declutter the UI;
     * however some settings (typically, the labs flags) are exposed but greyed out, to unveil
     * what features are available with the right server support.
     *
     * @param {string} settingName The name of the setting to check.
     * @param {String} roomId The room ID to check in, may be null.
     * @param {SettingLevel} level The level to check at.
     * @return {boolean} True if the user may set the setting, false otherwise.
     */
    public static canSetValue(settingName: SettingKey, roomId: string | null, level: SettingLevel): boolean {
        const setting = SETTINGS[settingName];
        // Verify that the setting is actually a setting
        if (!setting) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

        if (setting.controller?.settingDisabled) {
            return false;
        }

        // For some config settings (mostly: non-beta features), a value in config.json overrides the local setting
        // (ie: we force them as enabled or disabled). In this case we should not let the user change the setting.
        if (
            setting?.supportedLevelsAreOrdered &&
            SettingsStore.settingIsOveriddenAtConfigLevel(settingName, roomId, level)
        ) {
            return false;
        }

        const handler = SettingsStore.getHandler(settingName, level);
        if (!handler) return false;
        return handler.canSetValue(settingName, roomId);
    }

    /**
     * Determines if the setting at the specified level is overidden by one at a config level.
     * @param settingName The name of the setting to check.
     * @param roomId The room ID to check in, may be null.
     * @param level The level to check at.
     * @returns
     */
    public static settingIsOveriddenAtConfigLevel(
        settingName: SettingKey,
        roomId: string | null,
        level: SettingLevel,
    ): boolean {
        const setting = SETTINGS[settingName];
        const levelOrders = getLevelOrder(setting);
        const configIndex = levelOrders.indexOf(SettingLevel.CONFIG);
        const levelIndex = levelOrders.indexOf(level);
        if (configIndex === -1 || levelIndex === -1 || configIndex >= levelIndex) {
            return false;
        }
        const configVal = SettingsStore.getValueAt(SettingLevel.CONFIG, settingName, roomId, true, true);
        return configVal === true || configVal === false;
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
     * Determines if a setting supports a particular level.
     * @param settingName The setting name.
     * @param level The level.
     * @returns True if supported, false otherwise. Note that this will not check to see if
     * the level itself can be supported by the runtime (ie: you will need to call #isLevelSupported()
     * on your own).
     */
    public static doesSettingSupportLevel(settingName: SettingKey, level: SettingLevel): boolean {
        const setting = SETTINGS[settingName];
        if (!setting) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

        return level === SettingLevel.DEFAULT || !!setting.supportedLevels?.includes(level);
    }

    /**
     * Determines the first supported level out of all the levels that can be used for a
     * specific setting.
     * @param {string} settingName The setting name.
     * @return {SettingLevel}
     */
    public static firstSupportedLevel(settingName: SettingKey): SettingLevel | null {
        // Verify that the setting is actually a setting
        const setting = SETTINGS[settingName];
        if (!setting) {
            throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
        }

        const levelOrder = getLevelOrder(setting);
        if (!levelOrder.includes(SettingLevel.DEFAULT)) levelOrder.push(SettingLevel.DEFAULT); // always include default

        const handlers = SettingsStore.getHandlers(settingName);

        for (const level of levelOrder) {
            const handler = handlers[level];
            if (!handler) continue;
            return level;
        }
        return null;
    }

    /**
     * Migrate the setting for URL previews in e2e rooms from room account
     * data to the room device level.
     *
     * @param isFreshLogin True if the user has just logged in, false if a previous session is being restored.
     */
    private static async migrateURLPreviewsE2EE(isFreshLogin: boolean): Promise<void> {
        const MIGRATION_DONE_FLAG = "url_previews_e2ee_migration_done";
        if (localStorage.getItem(MIGRATION_DONE_FLAG)) return;
        if (isFreshLogin) return;

        const client = MatrixClientPeg.safeGet();

        const doMigration = async (): Promise<void> => {
            logger.info("Performing one-time settings migration of URL previews in E2EE rooms");

            const roomAccounthandler = LEVEL_HANDLERS[SettingLevel.ROOM_ACCOUNT];

            for (const room of client.getRooms()) {
                // We need to use the handler directly because this setting is no longer supported
                // at this level at all
                const val = roomAccounthandler.getValue("urlPreviewsEnabled_e2ee", room.roomId);

                if (val !== undefined) {
                    await SettingsStore.setValue("urlPreviewsEnabled_e2ee", room.roomId, SettingLevel.ROOM_DEVICE, val);
                }
            }

            localStorage.setItem(MIGRATION_DONE_FLAG, "true");
        };

        const onSync = (state: SyncState): void => {
            if (state === SyncState.Prepared) {
                client.removeListener(ClientEvent.Sync, onSync);

                doMigration().catch((e) => {
                    logger.error("Failed to migrate URL previews in E2EE rooms:", e);
                });
            }
        };

        client.on(ClientEvent.Sync, onSync);
    }

    /**
     * Migrate the setting for visible images to a setting.
     */
    private static migrateShowImagesToSettings(): void {
        const MIGRATION_DONE_FLAG = "mx_show_images_migration_done";
        if (localStorage.getItem(MIGRATION_DONE_FLAG)) return;

        logger.info("Performing one-time settings migration of shown images to settings store");
        const newValue = Object.fromEntries(
            Object.keys(localStorage)
                .filter((k) => k.startsWith("mx_ShowImage_"))
                .map((k) => [k.slice("mx_ShowImage_".length), true]),
        );
        this.setValue("showMediaEventIds", null, SettingLevel.DEVICE, newValue);

        localStorage.setItem(MIGRATION_DONE_FLAG, "true");
    }

    /**
     * Runs or queues any setting migrations needed.
     */
    public static runMigrations(isFreshLogin: boolean): void {
        // This can be removed once enough users have run a version of Element with
        // this migration. A couple of months after its release should be sufficient
        // (so around October 2024).
        // The consequences of missing the migration are only that URL previews will
        // be disabled in E2EE rooms.
        SettingsStore.migrateURLPreviewsE2EE(isFreshLogin);

        // This can be removed once enough users have run a version of Element with
        // this migration.
        // The consequences of missing the migration are that previously shown images
        // will now be hidden again, so this fails safely.
        SettingsStore.migrateShowImagesToSettings();

        // Dev notes: to add your migration, just add a new `migrateMyFeature` function, call it, and
        // add a comment to note when it can be removed.
        return;
    }

    /**
     * Debugging function for reading explicit setting values without going through the
     * complicated/biased functions in the SettingsStore. This will print information to
     * the console for analysis. Not intended to be used within the application.
     * @param {string} realSettingName The setting name to try and read.
     * @param {string} roomId Optional room ID to test the setting in.
     */
    public static debugSetting(realSettingName: SettingKey, roomId: string): void {
        logger.log(`--- DEBUG ${realSettingName}`);

        // Note: we intentionally use JSON.stringify here to avoid the console masking the
        // problem if there's a type representation issue. Also, this way it is guaranteed
        // to show up in a rageshake if required.

        const def = SETTINGS[realSettingName];
        logger.log(`--- definition: ${def ? JSON.stringify(def) : "<NOT_FOUND>"}`);
        logger.log(`--- default level order: ${JSON.stringify(LEVEL_ORDER)}`);
        logger.log(`--- registered handlers: ${JSON.stringify(Object.keys(LEVEL_HANDLERS))}`);

        const doChecks = (settingName: SettingKey): void => {
            for (const handlerName of Object.keys(LEVEL_HANDLERS)) {
                const handler = LEVEL_HANDLERS[handlerName as SettingLevel];

                try {
                    const value = handler.getValue(settingName, roomId);
                    logger.log(`---     ${handlerName}@${roomId || "<no_room>"} = ${JSON.stringify(value)}`);
                } catch (e) {
                    logger.log(
                        `---     ${handler.constructor.name}@${roomId || "<no_room>"} THREW ERROR: ${
                            e instanceof Error ? e.message : e
                        }`,
                    );
                    logger.error(e);
                }

                if (roomId) {
                    try {
                        const value = handler.getValue(settingName, null);
                        logger.log(`---     ${handlerName}@<no_room> = ${JSON.stringify(value)}`);
                    } catch (e) {
                        logger.log(
                            `---     ${handler.constructor.name}@<no_room> THREW ERROR: ${
                                e instanceof Error ? e.message : e
                            }`,
                        );
                        logger.error(e);
                    }
                }
            }

            logger.log(`--- calculating as returned by SettingsStore`);
            logger.log(`--- these might not match if the setting uses a controller - be warned!`);

            try {
                const value = SettingsStore.getValue(settingName, roomId);
                logger.log(`---     SettingsStore#generic@${roomId || "<no_room>"}  = ${JSON.stringify(value)}`);
            } catch (e) {
                logger.log(
                    `---     SettingsStore#generic@${roomId || "<no_room>"} THREW ERROR: ${
                        e instanceof Error ? e.message : e
                    }`,
                );
                logger.error(e);
            }

            if (roomId) {
                try {
                    const value = SettingsStore.getValue(settingName, null);
                    logger.log(`---     SettingsStore#generic@<no_room>  = ${JSON.stringify(value)}`);
                } catch (e) {
                    logger.log(
                        `---     SettingsStore#generic@$<no_room> THREW ERROR: ${e instanceof Error ? e.message : e}`,
                    );
                    logger.error(e);
                }
            }

            for (const level of LEVEL_ORDER) {
                try {
                    const value = SettingsStore.getValueAt(level, settingName, roomId);
                    logger.log(`---     SettingsStore#${level}@${roomId || "<no_room>"} = ${JSON.stringify(value)}`);
                } catch (e) {
                    logger.log(
                        `---     SettingsStore#${level}@${roomId || "<no_room>"} THREW ERROR: ${
                            e instanceof Error ? e.message : e
                        }`,
                    );
                    logger.error(e);
                }

                if (roomId) {
                    try {
                        const value = SettingsStore.getValueAt(level, settingName, null);
                        logger.log(`---     SettingsStore#${level}@<no_room> = ${JSON.stringify(value)}`);
                    } catch (e) {
                        logger.log(
                            `---     SettingsStore#${level}@$<no_room> THREW ERROR: ${
                                e instanceof Error ? e.message : e
                            }`,
                        );
                        logger.error(e);
                    }
                }
            }
        };

        doChecks(realSettingName);

        if (def.invertedSettingName) {
            logger.log(`--- TESTING INVERTED SETTING NAME`);
            logger.log(`--- inverted: ${def.invertedSettingName}`);
            doChecks(def.invertedSettingName as SettingKey);
        }

        logger.log(`--- END DEBUG`);
    }

    private static getHandler(settingName: SettingKey, level: SettingLevel): SettingsHandler | null {
        const handlers = SettingsStore.getHandlers(settingName);
        if (!handlers[level]) return null;
        return handlers[level]!;
    }

    private static getHandlers(settingName: SettingKey): HandlerMap {
        if (!SETTINGS[settingName]) return {};

        const handlers: Partial<Record<SettingLevel, SettingsHandler>> = {};
        for (const level of SETTINGS[settingName].supportedLevels) {
            if (!LEVEL_HANDLERS[level]) throw new Error("Unexpected level " + level);
            if (SettingsStore.isLevelSupported(level)) handlers[level] = LEVEL_HANDLERS[level];
        }

        // Always support 'default'
        if (!handlers["default"]) handlers["default"] = LEVEL_HANDLERS["default"];

        return handlers;
    }
}

// For debugging purposes
window.mxSettingsStore = SettingsStore;

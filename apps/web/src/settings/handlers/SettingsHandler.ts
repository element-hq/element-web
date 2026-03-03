/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2017 Travis Ralston

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type WatchManager } from "../WatchManager";

/**
 * Represents the base class for all level handlers. This class performs no logic
 * and should be overridden.
 */
export default abstract class SettingsHandler {
    public readonly watchers?: WatchManager;

    /**
     * Gets the value for a particular setting at this level for a particular room.
     * If no room is applicable, the roomId may be null. The roomId may not be
     * applicable to this level and may be ignored by the handler.
     * @param {string} settingName The name of the setting.
     * @param {String} roomId The room ID to read from, may be null.
     * @returns {*} The setting value, or null if not found.
     */
    public abstract getValue(settingName: string, roomId: string | null): any;

    /**
     * Sets the value for a particular setting at this level for a particular room.
     * If no room is applicable, the roomId may be null. The roomId may not be
     * applicable to this level and may be ignored by the handler. Setting a value
     * to null will cause the level to remove the value. The current user should be
     * able to set the value prior to calling this.
     * @param {string} settingName The name of the setting to change.
     * @param {String} roomId The room ID to set the value in, may be null.
     * @param {*} newValue The new value for the setting, may be null.
     * @returns {Promise} Resolves when the setting has been saved.
     */
    public abstract setValue(settingName: string, roomId: string | null, newValue: any): Promise<void>;

    /**
     * Determines if the current user is able to set the value of the given setting
     * in the given room at this level.
     * @param {string} settingName The name of the setting to check.
     * @param {String} roomId The room ID to check in, may be null
     * @returns {boolean} True if the setting can be set by the user, false otherwise.
     */
    public abstract canSetValue(settingName: string, roomId: string | null): boolean;

    /**
     * Determines if this level is supported on this device.
     * @returns {boolean} True if this level is supported on the current device.
     */
    public abstract isSupported(): boolean;

    /**
     * Resets the handler, clearing any caches or other stored data. Called on user logout.
     */
    public reset(): void {}
}

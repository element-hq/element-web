/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Watchable } from "./watchable";

/**
 * The different levels at which settings can be stored,
 * @alpha Subject to change.
 */
export enum Level {
    DEVICE = "device",
}

/**
 * The possible types that a setting value could be.
 * @alpha Subject to change.
 */
export type SettingValueType = null | string | number | boolean;

/**
 * Details of a given setting.
 * @alpha Subject to change.
 */
export interface BaseSettings<T extends SettingValueType = SettingValueType> {
    /**
     * The default value of this setting.
     */
    default: T;
    /**
     * The levels at which this setting can be set.
     */
    supportedLevels: Level[];
}

/**
 * This type represents custom settings used by a module.
 * @alpha Subject to change.
 */
export interface Settings {
    [settingsName: `module.${string}`]: BaseSettings;
}

/**
 * API for reading application settings.
 * @alpha Subject to change.
 */
export interface SettingsApi<T extends Settings = Settings> {
    /**
     * Register new settings used by your module.
     * @param settings - The new settings to register.
     */
    registerSettings(settings: T): void;

    /**
     * Gets the value of a setting, computed across all applicable levels
     * (device, room, account, config, default, etc.).
     * @param settingName - The name of the setting to read.
     * @param roomId - Room ID to read a room-scoped value for, or null/undefined for a
     * non-room-scoped value.
     * @param excludeDefault - If true, do not fall back to the setting's default value.
     */
    getValue<K extends keyof Settings>(
        settingName: K,
        roomId?: string | null,
        excludeDefault?: boolean,
    ): Watchable<T[K]["default"]>;

    /**
     * Gets the value of a setting, computed across all applicable levels
     * (device, room, account, config, default, etc.).
     * @param settingName - The name of the setting to read.
     * @param roomId - Room ID to read a room-scoped value for, or null/undefined for a
     * non-room-scoped value.
     * @param excludeDefault - If true, do not fall back to the setting's default value.
     */
    getValue<T = any>(settingName: string, roomId?: string | null, excludeDefault?: boolean): Watchable<T>;

    /**
     * Set the value of a setting.
     * @param settingName - The setting to set
     * @param roomId - The room in which to change the setting, may be null.
     * @param level - The level at which this setting is set, see {@link Level}
     * @param value - The setting value
     */
    setValue<K extends keyof Settings>(
        settingName: K,
        roomId: string | null,
        level: Level,
        value: T[K]["default"],
    ): Promise<void>;

    /**
     * Set the value of a setting.
     * @param settingName - The setting to set
     * @param roomId - The room in which to change the setting, may be null.
     * @param level - The level at which this setting is set, see {@link Level}
     * @param value - The setting value
     */
    setValue<T = any>(settingName: string, roomId: string | null, level: Level, value: T): Promise<void>;
}

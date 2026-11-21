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
 * Maps the name of each setting a module owns to the type of its value.
 * It is empty here: modules add their own settings to it with declaration merging,
 * which gives them typed values from {@link SettingsApi} everywhere in the module.
 *
 * @example
 * ```ts
 * declare module "@element-hq/element-web-module-api" {
 *     interface ModuleSettingValues {
 *         "module.myModule.enabled": boolean;
 *     }
 * }
 * ```
 * @alpha Subject to change.
 */
// oxlint-disable-next-line typescript/no-empty-object-type -- Empty on purpose: modules add their settings to it.
export interface ModuleSettingValues {}

/**
 * The value type of the setting `K`: the type declared in {@link ModuleSettingValues}
 * for a module's own settings, otherwise `any` (for example, for app settings).
 * @alpha Subject to change.
 */
export type SettingValue<K extends string> = K extends keyof ModuleSettingValues ? ModuleSettingValues[K] : any;

/**
 * The setting names accepted by {@link SettingsApi}: names starting with `module.` must be declared in
 * {@link ModuleSettingValues}, so a typo in a module setting name is a type error. Any other name
 * (for example, an app setting) is accepted as is.
 * @alpha Subject to change.
 */
export type SettingName<K extends string> = K extends `module.${string}`
    ? K extends keyof ModuleSettingValues
        ? K
        : never
    : K;

/**
 * API for reading and writing application settings.
 * @alpha Subject to change.
 */
export interface SettingsApi {
    /**
     * Register the settings used by your module.
     * You must extend {@link ModuleSettingValues} through declaration merging to get
     * strong typing.
     * Each setting name must be of the form `module.<your module name>.<setting name>`, for example
     * `module.myModule.enabled`, and must not already be registered.
     * @param settings - The settings to register, keyed by setting name.
     */
    registerSettings(settings: { [K in keyof ModuleSettingValues]: BaseSettings<ModuleSettingValues[K]> }): void;

    /**
     * Gets the value of a setting, computed across all applicable levels
     * (device, room, account, config, default, etc.).
     * @param settingName - The name of the setting to read.
     * @param roomId - Room ID to read a room-scoped value for, or null/undefined for a
     * non-room-scoped value.
     * @param excludeDefault - If true, do not fall back to the setting's default value.
     *
     * @deprecated Use {@link SettingsApi.getValueWatchable} instead.
     */
    getValue<T = any>(settingName: string, roomId?: string | null, excludeDefault?: boolean): T | undefined;

    /**
     * Gets the value of a setting as a watchable, computed across all applicable levels
     * (device, room, account, config, default, etc.).
     * Settings declared in {@link ModuleSettingValues} are typed; other settings are `any`.
     * @param settingName - The name of the setting to read.
     * @param roomId - Room ID to read a room-scoped value for, or null/undefined for a
     * non-room-scoped value.
     * @param excludeDefault - If true, do not fall back to the setting's default value.
     * @returns A watchable holding the setting value, which updates when the setting changes.
     */
    getValueWatchable<K extends string>(
        settingName: SettingName<K>,
        roomId?: string | null,
        excludeDefault?: boolean,
    ): Watchable<SettingValue<K>>;

    /**
     * Set the value of a setting.
     * @param settingName - The setting to set
     * @param roomId - The room in which to change the setting, may be null.
     * @param level - The level at which this setting is set, see {@link Level}
     * @param value - The setting value
     */
    setValue<K extends string>(
        settingName: SettingName<K>,
        roomId: string | null,
        level: Level,
        value: SettingValue<K>,
    ): Promise<void>;
}

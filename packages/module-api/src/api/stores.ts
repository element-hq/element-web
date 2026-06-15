/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "../models/Room";
import { type Watchable } from "./watchable";

/**
 * Provides some basic functionality of the Room List Store from element-web.
 * @public
 */
export interface RoomListStoreApi {
    /**
     * Returns a watchable holding a flat list of sorted room.
     */
    getRooms(): Watchable<Room[]>;

    /**
     * Returns a promise that resolves when RLS is ready.
     */
    waitForReady(): Promise<void>;
}

/**
 * The different levels at which settings can be configured.
 * See {@link <insert_element_web_settings_doc_link>}
 */
export enum SettingsLevel {
    DEVICE = "device",
}

export interface Setting<T> {
    name: string;
    info: {
        default: T;
    };
}

/**
 * API to get/set values from the settings store.
 */
export interface SettingsStoreApi {
    /**
     * Get setting value.
     * @param settingName The setting to fetch
     */
    getValue(settingName: string): Watchable<unknown>;

    /**
     * Set setting value.
     * @param settingName The setting to set
     * @param level The level at which this setting is set, see {@link SettingsLevel}
     * @param value The setting value
     */
    setValue(settingName: string, level: SettingsLevel, value: unknown): Promise<void>;

    /**
     * Register a list of settings with element-web's setting store.
     * @param settings A list of settings to register
     */
    registerSettings(settings: Setting<unknown>[]): void;
}

/**
 * Provides access to certain stores from element-web.
 * @public
 */
export interface StoresApi {
    /**
     * Use this to access limited functionality of the RLS from element-web.
     */
    roomListStore: RoomListStoreApi;

    /**
     * Api to manipulate settings.
     */
    settingsStore: SettingsStoreApi;
}

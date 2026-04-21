/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "../models/Room";
import { type Watchable } from "./watchable";

/**
 * Represents the various setting levels supported by the SettingsStore.
 * @public
 */
export enum SettingLevel {
    DEVICE = "device",
    ROOM_DEVICE = "room-device",
    ROOM_ACCOUNT = "room-account",
    ACCOUNT = "account",
    ROOM = "room",
    PLATFORM = "platform",
    CONFIG = "config",
    DEFAULT = "default",
}

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
 * Provides access to limited functionality of the Settings Store.
 * @alpha
 */
export interface SettingsStoreApi {
    /**
     * Change the supported settings level for a given setting.
     *
     * @param settingName - The name of the setting that should be changed.
     * @param levels - The new set of levels to be supported by the setting
     * @public
     * @throws If the setting name is not known to Element.
     */
    overrideSettingsSupportedLevels(settingName: string, levels: SettingLevel[]): void;
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
     * Use this to access limited functionality of the SettingsStore from element-web.
     */
    settingsStore: SettingsStoreApi;
}

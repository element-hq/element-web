/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * API for reading application settings.
 * @alpha Subject to change.
 */
export interface SettingsApi {
    /**
     * Gets the value of a setting, computed across all applicable levels
     * (device, room, account, config, default, etc.).
     * @param settingName - The name of the setting to read.
     * @param roomId - Room ID to read a room-scoped value for, or null/undefined for a
     * non-room-scoped value.
     * @param excludeDefault - If true, do not fall back to the setting's default value.
     */
    getValue<T = any>(settingName: string, roomId?: string | null, excludeDefault?: boolean): T | undefined;
}

/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Represents the various setting levels supported by the SettingsStore.
 */
export enum SettingLevel {
    // TODO: [TS] Follow naming convention
    DEVICE = "device",
    ROOM_DEVICE = "room-device",
    ROOM_ACCOUNT = "room-account",
    ACCOUNT = "account",
    ROOM = "room",
    PLATFORM = "platform",
    CONFIG = "config",
    DEFAULT = "default",
}

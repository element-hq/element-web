/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 - 2022 The Matrix.org Foundation C.I.C.
Copyright 2017 Travis Ralston

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { safeSet } from "matrix-js-sdk/src/utils";

import { SettingLevel } from "../SettingLevel";
import { type WatchManager } from "../WatchManager";
import AbstractLocalStorageSettingsHandler from "./AbstractLocalStorageSettingsHandler";

/**
 * Gets and sets settings at the "room-device" level for the current device in a particular
 * room.
 */
export default class RoomDeviceSettingsHandler extends AbstractLocalStorageSettingsHandler {
    public constructor(public readonly watchers: WatchManager) {
        super();
    }

    public getValue(settingName: string, roomId: string): any {
        // Special case blacklist setting to use legacy values
        if (settingName === "blacklistUnverifiedDevices") {
            const value = this.read("mx_local_settings");
            if (value?.["blacklistUnverifiedDevicesPerRoom"]) {
                return value["blacklistUnverifiedDevicesPerRoom"][roomId];
            }
        }

        const value = this.read(this.getKey(settingName, roomId));
        if (value) return value.value;
        return null;
    }

    public setValue(settingName: string, roomId: string, newValue: any): Promise<void> {
        // Special case blacklist setting for legacy structure
        if (settingName === "blacklistUnverifiedDevices") {
            let value = this.read("mx_local_settings");
            if (!value) value = {};
            if (!value["blacklistUnverifiedDevicesPerRoom"]) value["blacklistUnverifiedDevicesPerRoom"] = {};
            safeSet(value["blacklistUnverifiedDevicesPerRoom"], roomId, newValue);
            this.setObject("mx_local_settings", value);
            this.watchers.notifyUpdate(settingName, roomId, SettingLevel.ROOM_DEVICE, newValue);
            return Promise.resolve();
        }

        if (newValue === null) {
            this.removeItem(this.getKey(settingName, roomId));
        } else {
            this.setObject(this.getKey(settingName, roomId), { value: newValue });
        }

        this.watchers.notifyUpdate(settingName, roomId, SettingLevel.ROOM_DEVICE, newValue);
        return Promise.resolve();
    }

    public canSetValue(settingName: string, roomId: string): boolean {
        return true; // It's their device, so they should be able to
    }

    private read(key: string): any {
        return this.getObject(key);
    }

    private getKey(settingName: string, roomId: string): string {
        return "mx_setting_" + settingName + "_" + roomId;
    }
}

/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import RoomDeviceSettingsHandler from "../../../../src/settings/handlers/RoomDeviceSettingsHandler";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import { type CallbackFn, WatchManager } from "../../../../src/settings/WatchManager";

describe("RoomDeviceSettingsHandler", () => {
    const roomId = "!room:example.com";
    const value = "test value";
    const testSettings = [
        "RightPanel.phases",
        // special case in RoomDeviceSettingsHandler
        "blacklistUnverifiedDevices",
    ];
    let watchers: WatchManager;
    let handler: RoomDeviceSettingsHandler;
    let settingListener: CallbackFn;

    beforeEach(() => {
        watchers = new WatchManager();
        handler = new RoomDeviceSettingsHandler(watchers);
        settingListener = jest.fn();
    });

    afterEach(() => {
        watchers.unwatchSetting(settingListener);
    });

    it.each(testSettings)("should write/read/clear the value for »%s«", (setting: string): void => {
        // initial value should be null
        watchers.watchSetting(setting, roomId, settingListener);

        expect(handler.getValue(setting, roomId)).toBeNull();

        // set and read value
        handler.setValue(setting, roomId, value);
        expect(settingListener).toHaveBeenCalledWith(roomId, SettingLevel.ROOM_DEVICE, value);
        expect(handler.getValue(setting, roomId)).toEqual(value);

        // clear value
        handler.setValue(setting, roomId, null);
        expect(settingListener).toHaveBeenCalledWith(roomId, SettingLevel.ROOM_DEVICE, null);
        expect(handler.getValue(setting, roomId)).toBeNull();
    });

    it("canSetValue should return true", () => {
        expect(handler.canSetValue("test setting", roomId)).toBe(true);
    });
});

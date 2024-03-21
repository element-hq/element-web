/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import RoomDeviceSettingsHandler from "../../../src/settings/handlers/RoomDeviceSettingsHandler";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { CallbackFn, WatchManager } from "../../../src/settings/WatchManager";

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

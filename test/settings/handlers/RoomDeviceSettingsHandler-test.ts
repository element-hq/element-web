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
import { WatchManager } from "../../../src/settings/WatchManager";

describe("RoomDeviceSettingsHandler", () => {
    it("should correctly read cached values", () => {
        const watchers = new WatchManager();
        const handler = new RoomDeviceSettingsHandler(watchers);

        const settingName = "RightPanel.phases";
        const roomId = "!room:server";
        const value = {
            isOpen: true,
            history: [{}],
        };

        handler.setValue(settingName, roomId, value);
        expect(handler.getValue(settingName, roomId)).toEqual(value);
    });
});

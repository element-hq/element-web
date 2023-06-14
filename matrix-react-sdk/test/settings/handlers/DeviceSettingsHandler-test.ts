/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { mocked } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/client";

import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import DeviceSettingsHandler from "../../../src/settings/handlers/DeviceSettingsHandler";
import { CallbackFn, WatchManager } from "../../../src/settings/WatchManager";
import { stubClient } from "../../test-utils/test-utils";

describe("DeviceSettingsHandler", () => {
    const ROOM_ID_IS_UNUSED = "";

    const unknownSettingKey = "unknown_setting";
    const featureKey = "my_feature";

    let watchers: WatchManager;
    let handler: DeviceSettingsHandler;
    let settingListener: CallbackFn;

    beforeEach(() => {
        watchers = new WatchManager();
        handler = new DeviceSettingsHandler([featureKey], watchers);
        settingListener = jest.fn();
    });

    afterEach(() => {
        watchers.unwatchSetting(settingListener);
    });

    it("Returns undefined for an unknown setting", () => {
        expect(handler.getValue(unknownSettingKey, ROOM_ID_IS_UNUSED)).toBeUndefined();
    });

    it("Returns the value for a disabled feature", () => {
        handler.setValue(featureKey, ROOM_ID_IS_UNUSED, false);
        expect(handler.getValue(featureKey, ROOM_ID_IS_UNUSED)).toBe(false);
    });

    it("Returns the value for an enabled feature", () => {
        handler.setValue(featureKey, ROOM_ID_IS_UNUSED, true);
        expect(handler.getValue(featureKey, ROOM_ID_IS_UNUSED)).toBe(true);
    });

    describe("If I am a guest", () => {
        let client: MatrixClient;

        beforeEach(() => {
            client = stubClient();
            mocked(client.isGuest).mockReturnValue(true);
        });

        afterEach(() => {
            MatrixClientPeg.get = () => null;
            MatrixClientPeg.safeGet = () => null;
        });

        it("Returns the value for a disabled feature", () => {
            handler.setValue(featureKey, ROOM_ID_IS_UNUSED, false);
            expect(handler.getValue(featureKey, ROOM_ID_IS_UNUSED)).toBe(false);
        });

        it("Returns the value for an enabled feature", () => {
            handler.setValue(featureKey, ROOM_ID_IS_UNUSED, true);
            expect(handler.getValue(featureKey, ROOM_ID_IS_UNUSED)).toBe(true);
        });
    });
});

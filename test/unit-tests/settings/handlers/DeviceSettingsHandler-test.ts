/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import DeviceSettingsHandler from "../../../../src/settings/handlers/DeviceSettingsHandler";
import { type CallbackFn, WatchManager } from "../../../../src/settings/WatchManager";
import { stubClient } from "../../../test-utils/test-utils";

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
            MatrixClientPeg.safeGet = () => new MatrixClient({ baseUrl: "foobar" });
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

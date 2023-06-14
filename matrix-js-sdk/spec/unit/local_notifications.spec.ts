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

import { LocalNotificationSettings } from "../../src/@types/local_notifications";
import { LOCAL_NOTIFICATION_SETTINGS_PREFIX, MatrixClient } from "../../src/matrix";
import { TestClient } from "../TestClient";

let client: MatrixClient;

describe("Local notification settings", () => {
    beforeEach(() => {
        client = new TestClient("@alice:matrix.org", "123", undefined, undefined, undefined).client;
        client.setAccountData = jest.fn();
    });

    describe("Lets you set local notification settings", () => {
        it("stores settings in account data", () => {
            const deviceId = "device";
            const settings: LocalNotificationSettings = { is_silenced: true };
            client.setLocalNotificationSettings(deviceId, settings);

            expect(client.setAccountData).toHaveBeenCalledWith(
                `${LOCAL_NOTIFICATION_SETTINGS_PREFIX.name}.${deviceId}`,
                settings,
            );
        });
    });
});

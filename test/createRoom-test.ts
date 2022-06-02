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

import { mocked } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { IDevice } from "matrix-js-sdk/src/crypto/deviceinfo";
import { RoomType } from "matrix-js-sdk/src/@types/event";

import { stubClient, setupAsyncStoreWithClient } from "./test-utils";
import { MatrixClientPeg } from "../src/MatrixClientPeg";
import WidgetStore from "../src/stores/WidgetStore";
import WidgetUtils from "../src/utils/WidgetUtils";
import { VIDEO_CHANNEL_MEMBER } from "../src/utils/VideoChannelUtils";
import createRoom, { canEncryptToAllUsers } from '../src/createRoom';

describe("createRoom", () => {
    let client: MatrixClient;
    beforeEach(() => {
        stubClient();
        client = MatrixClientPeg.get();
    });

    it("sets up video rooms correctly", async () => {
        setupAsyncStoreWithClient(WidgetStore.instance, client);
        jest.spyOn(WidgetUtils, "waitForRoomWidget").mockResolvedValue();

        const roomId = await createRoom({ roomType: RoomType.ElementVideo });
        const [[{
            power_level_content_override: {
                events: { [VIDEO_CHANNEL_MEMBER]: videoMemberPower },
            },
        }]] = mocked(client.createRoom).mock.calls as any; // no good type
        const [[widgetRoomId, widgetStateKey]] = mocked(client.sendStateEvent).mock.calls;

        // We should have set up the Jitsi widget
        expect(widgetRoomId).toEqual(roomId);
        expect(widgetStateKey).toEqual("im.vector.modular.widgets");

        // All members should be able to update their connected devices
        expect(videoMemberPower).toEqual(0);
    });
});

describe("canEncryptToAllUsers", () => {
    const trueUser = {
        "@goodUser:localhost": {
            "DEV1": {} as unknown as IDevice,
            "DEV2": {} as unknown as IDevice,
        },
    };
    const falseUser = {
        "@badUser:localhost": {},
    };

    let client: MatrixClient;
    beforeEach(() => {
        stubClient();
        client = MatrixClientPeg.get();
    });

    it("returns true if all devices have crypto", async () => {
        mocked(client.downloadKeys).mockResolvedValue(trueUser);
        const response = await canEncryptToAllUsers(client, ["@goodUser:localhost"]);
        expect(response).toBe(true);
    });

    it("returns false if not all users have crypto", async () => {
        mocked(client.downloadKeys).mockResolvedValue({ ...trueUser, ...falseUser });
        const response = await canEncryptToAllUsers(client, ["@goodUser:localhost", "@badUser:localhost"]);
        expect(response).toBe(false);
    });
});

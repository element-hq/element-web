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

import { mocked, Mocked } from "jest-mock";
import { CryptoApi, MatrixClient, Device } from "matrix-js-sdk/src/matrix";
import { RoomType } from "matrix-js-sdk/src/@types/event";

import { stubClient, setupAsyncStoreWithClient, mockPlatformPeg } from "./test-utils";
import { MatrixClientPeg } from "../src/MatrixClientPeg";
import WidgetStore from "../src/stores/WidgetStore";
import WidgetUtils from "../src/utils/WidgetUtils";
import { JitsiCall, ElementCall } from "../src/models/Call";
import createRoom, { canEncryptToAllUsers } from "../src/createRoom";
import SettingsStore from "../src/settings/SettingsStore";

describe("createRoom", () => {
    mockPlatformPeg();

    let client: Mocked<MatrixClient>;
    beforeEach(() => {
        stubClient();
        client = mocked(MatrixClientPeg.safeGet());
    });

    afterEach(() => jest.clearAllMocks());

    it("sets up Jitsi video rooms correctly", async () => {
        setupAsyncStoreWithClient(WidgetStore.instance, client);
        jest.spyOn(WidgetUtils, "waitForRoomWidget").mockResolvedValue();
        const createCallSpy = jest.spyOn(JitsiCall, "create");

        const userId = client.getUserId()!;
        const roomId = await createRoom(client, { roomType: RoomType.ElementVideo });

        const [
            [
                {
                    power_level_content_override: {
                        users: { [userId]: userPower },
                        events: {
                            "im.vector.modular.widgets": widgetPower,
                            [JitsiCall.MEMBER_EVENT_TYPE]: callMemberPower,
                        },
                    },
                },
            ],
        ] = client.createRoom.mock.calls as any; // no good type

        // We should have had enough power to be able to set up the widget
        expect(userPower).toBeGreaterThanOrEqual(widgetPower);
        // and should have actually set it up
        expect(createCallSpy).toHaveBeenCalled();

        // All members should be able to update their connected devices
        expect(callMemberPower).toEqual(0);
        // widget should be immutable for admins
        expect(widgetPower).toBeGreaterThan(100);
        // and we should have been reset back to admin
        expect(client.setPowerLevel).toHaveBeenCalledWith(roomId, userId, 100, null);
    });

    it("sets up Element video rooms correctly", async () => {
        const userId = client.getUserId()!;
        const createCallSpy = jest.spyOn(ElementCall, "create");
        const roomId = await createRoom(client, { roomType: RoomType.UnstableCall });

        const userPower = client.createRoom.mock.calls[0][0].power_level_content_override?.users?.[userId];
        const callPower =
            client.createRoom.mock.calls[0][0].power_level_content_override?.events?.[ElementCall.CALL_EVENT_TYPE.name];
        const callMemberPower =
            client.createRoom.mock.calls[0][0].power_level_content_override?.events?.[
                ElementCall.MEMBER_EVENT_TYPE.name
            ];

        // We should have had enough power to be able to set up the call
        expect(userPower).toBeGreaterThanOrEqual(callPower!);
        // and should have actually set it up
        expect(createCallSpy).toHaveBeenCalled();

        // All members should be able to update their connected devices
        expect(callMemberPower).toEqual(0);
        // call should be immutable for admins
        expect(callPower).toBeGreaterThan(100);
        // and we should have been reset back to admin
        expect(client.setPowerLevel).toHaveBeenCalledWith(roomId, userId, 100, null);
    });

    it("doesn't create calls in non-video-rooms", async () => {
        const createJitsiCallSpy = jest.spyOn(JitsiCall, "create");
        const createElementCallSpy = jest.spyOn(ElementCall, "create");

        await createRoom(client, {});

        expect(createJitsiCallSpy).not.toHaveBeenCalled();
        expect(createElementCallSpy).not.toHaveBeenCalled();
    });

    it("correctly sets up MSC3401 power levels", async () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string) => {
            if (name === "feature_group_calls") return true;
        });

        await createRoom(client, {});

        const callPower =
            client.createRoom.mock.calls[0][0].power_level_content_override?.events?.[ElementCall.CALL_EVENT_TYPE.name];
        const callMemberPower =
            client.createRoom.mock.calls[0][0].power_level_content_override?.events?.[
                ElementCall.MEMBER_EVENT_TYPE.name
            ];

        expect(callPower).toBe(100);
        expect(callMemberPower).toBe(100);
    });

    it("should upload avatar if one is passed", async () => {
        client.uploadContent.mockResolvedValue({ content_uri: "mxc://foobar" });
        const avatar = new File([], "avatar.png");
        await createRoom(client, { avatar });
        expect(client.createRoom).toHaveBeenCalledWith(
            expect.objectContaining({
                initial_state: expect.arrayContaining([
                    {
                        content: {
                            url: "mxc://foobar",
                        },
                        type: "m.room.avatar",
                    },
                ]),
            }),
        );
    });
});

describe("canEncryptToAllUsers", () => {
    const user1Id = "@user1:example.com";
    const user2Id = "@user2:example.com";

    const devices = new Map([
        ["DEV1", {} as unknown as Device],
        ["DEV2", {} as unknown as Device],
    ]);

    let client: Mocked<MatrixClient>;
    let cryptoApi: Mocked<CryptoApi>;

    beforeAll(() => {
        client = mocked(stubClient());
        cryptoApi = mocked(client.getCrypto()!);
    });

    it("should return true if userIds is empty", async () => {
        cryptoApi.getUserDeviceInfo.mockResolvedValue(new Map());
        const result = await canEncryptToAllUsers(client, []);
        expect(result).toBe(true);
    });

    it("should return true if download keys does not return any user", async () => {
        cryptoApi.getUserDeviceInfo.mockResolvedValue(new Map());
        const result = await canEncryptToAllUsers(client, [user1Id, user2Id]);
        expect(result).toBe(true);
    });

    it("should return false if none of the users has a device", async () => {
        cryptoApi.getUserDeviceInfo.mockResolvedValue(
            new Map([
                [user1Id, new Map()],
                [user2Id, new Map()],
            ]),
        );
        const result = await canEncryptToAllUsers(client, [user1Id, user2Id]);
        expect(result).toBe(false);
    });

    it("should return false if some of the users don't have a device", async () => {
        cryptoApi.getUserDeviceInfo.mockResolvedValue(
            new Map([
                [user1Id, new Map()],
                [user2Id, devices],
            ]),
        );
        const result = await canEncryptToAllUsers(client, [user1Id, user2Id]);
        expect(result).toBe(false);
    });

    it("should return true if all users have a device", async () => {
        cryptoApi.getUserDeviceInfo.mockResolvedValue(
            new Map([
                [user1Id, devices],
                [user2Id, devices],
            ]),
        );
        const result = await canEncryptToAllUsers(client, [user1Id, user2Id]);
        expect(result).toBe(true);
    });
});

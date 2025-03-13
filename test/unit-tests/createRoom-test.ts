/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked, type Mocked } from "jest-mock";
import { type MatrixClient, type Device, Preset, RoomType } from "matrix-js-sdk/src/matrix";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc";

import { stubClient, setupAsyncStoreWithClient, mockPlatformPeg, getMockClientWithEventEmitter } from "../test-utils";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import WidgetStore from "../../src/stores/WidgetStore";
import WidgetUtils from "../../src/utils/WidgetUtils";
import { JitsiCall, ElementCall } from "../../src/models/Call";
import createRoom, { checkUserIsAllowedToChangeEncryption, canEncryptToAllUsers } from "../../src/createRoom";
import SettingsStore from "../../src/settings/SettingsStore";

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
        expect(client.setPowerLevel).toHaveBeenCalledWith(roomId, userId, 100);
    });

    it("sets up Element video rooms correctly", async () => {
        const userId = client.getUserId()!;
        const createCallSpy = jest.spyOn(ElementCall, "create");
        const callMembershipSpy = jest.spyOn(MatrixRTCSession, "callMembershipsForRoom");
        callMembershipSpy.mockReturnValue([]);

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
        expect(client.setPowerLevel).toHaveBeenCalledWith(roomId, userId, 100);
    });

    it("doesn't create calls in non-video-rooms", async () => {
        const createJitsiCallSpy = jest.spyOn(JitsiCall, "create");
        const createElementCallSpy = jest.spyOn(ElementCall, "create");

        await createRoom(client, {});

        expect(createJitsiCallSpy).not.toHaveBeenCalled();
        expect(createElementCallSpy).not.toHaveBeenCalled();
    });

    it("correctly sets up MSC3401 power levels", async () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string): any => {
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
        expect(callMemberPower).toBe(0);
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

    it("should strip self-invite", async () => {
        await createRoom(client, { dmUserId: client.getSafeUserId() });
        expect(client.createRoom).toHaveBeenCalledWith(
            expect.not.objectContaining({
                invite: expect.any(Array),
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

describe("checkUserIsAllowedToChangeEncryption()", () => {
    const mockClient = getMockClientWithEventEmitter({
        doesServerForceEncryptionForPreset: jest.fn(),
        getClientWellKnown: jest.fn().mockReturnValue({}),
    });
    beforeEach(() => {
        mockClient.doesServerForceEncryptionForPreset.mockClear().mockResolvedValue(false);
        mockClient.getClientWellKnown.mockClear().mockReturnValue({});
    });

    it("should allow changing when neither server nor well known force encryption", async () => {
        expect(await checkUserIsAllowedToChangeEncryption(mockClient, Preset.PrivateChat)).toEqual({
            allowChange: true,
        });

        expect(mockClient.doesServerForceEncryptionForPreset).toHaveBeenCalledWith(Preset.PrivateChat);
    });

    it("should not allow changing when server forces encryption", async () => {
        mockClient.doesServerForceEncryptionForPreset.mockResolvedValue(true);
        expect(await checkUserIsAllowedToChangeEncryption(mockClient, Preset.PrivateChat)).toEqual({
            allowChange: false,
            forcedValue: true,
        });
    });

    it("should not allow changing when well-known force_disable is true", async () => {
        mockClient.getClientWellKnown.mockReturnValue({
            "io.element.e2ee": {
                force_disable: true,
            },
        });
        expect(await checkUserIsAllowedToChangeEncryption(mockClient, Preset.PrivateChat)).toEqual({
            allowChange: false,
            forcedValue: false,
        });
    });

    it("should not allow changing when server forces enabled and wk forces disabled encryption", async () => {
        mockClient.getClientWellKnown.mockReturnValue({
            "io.element.e2ee": {
                force_disable: true,
            },
        });
        mockClient.doesServerForceEncryptionForPreset.mockResolvedValue(true);
        expect(await checkUserIsAllowedToChangeEncryption(mockClient, Preset.PrivateChat)).toEqual(
            // server's forced enable takes precedence
            { allowChange: false, forcedValue: true },
        );
    });
});

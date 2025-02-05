/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { type Room, RoomType } from "matrix-js-sdk/src/matrix";

import { VisibilityProvider } from "../../../../../src/stores/room-list/filters/VisibilityProvider";
import LegacyCallHandler from "../../../../../src/LegacyCallHandler";
import VoipUserMapper from "../../../../../src/VoipUserMapper";
import { LocalRoom, LOCAL_ROOM_ID_PREFIX } from "../../../../../src/models/LocalRoom";
import { RoomListCustomisations } from "../../../../../src/customisations/RoomList";
import { createTestClient } from "../../../../test-utils";

jest.mock("../../../../../src/VoipUserMapper", () => ({
    sharedInstance: jest.fn(),
}));

jest.mock("../../../../../src/LegacyCallHandler", () => ({
    instance: {
        getSupportsVirtualRooms: jest.fn(),
    },
}));

jest.mock("../../../../../src/customisations/RoomList", () => ({
    RoomListCustomisations: {
        isRoomVisible: jest.fn(),
    },
}));

const createRoom = (isSpaceRoom = false): Room => {
    return {
        isSpaceRoom: () => isSpaceRoom,
        getType: () => (isSpaceRoom ? RoomType.Space : undefined),
    } as unknown as Room;
};

const createLocalRoom = (): LocalRoom => {
    const room = new LocalRoom(LOCAL_ROOM_ID_PREFIX + "test", createTestClient(), "@test:example.com");
    room.isSpaceRoom = () => false;
    return room;
};

describe("VisibilityProvider", () => {
    let mockVoipUserMapper: VoipUserMapper;

    beforeEach(() => {
        mockVoipUserMapper = {
            onNewInvitedRoom: jest.fn(),
            isVirtualRoom: jest.fn(),
        } as unknown as VoipUserMapper;
        mocked(VoipUserMapper.sharedInstance).mockReturnValue(mockVoipUserMapper);
    });

    describe("instance", () => {
        it("should return an instance", () => {
            const visibilityProvider = VisibilityProvider.instance;
            expect(visibilityProvider).toBeInstanceOf(VisibilityProvider);
            expect(VisibilityProvider.instance).toBe(visibilityProvider);
        });
    });

    describe("onNewInvitedRoom", () => {
        it("should call onNewInvitedRoom on VoipUserMapper.sharedInstance", async () => {
            const room = {} as unknown as Room;
            await VisibilityProvider.instance.onNewInvitedRoom(room);
            expect(mockVoipUserMapper.onNewInvitedRoom).toHaveBeenCalledWith(room);
        });
    });

    describe("isRoomVisible", () => {
        describe("for a virtual room", () => {
            beforeEach(() => {
                mocked(LegacyCallHandler.instance.getSupportsVirtualRooms).mockReturnValue(true);
                mocked(mockVoipUserMapper.isVirtualRoom).mockReturnValue(true);
            });

            it("should return return false", () => {
                const room = createRoom();
                expect(VisibilityProvider.instance.isRoomVisible(room)).toBe(false);
                expect(mockVoipUserMapper.isVirtualRoom).toHaveBeenCalledWith(room);
            });
        });

        it("should return false without room", () => {
            expect(VisibilityProvider.instance.isRoomVisible()).toBe(false);
        });

        it("should return false for a space room", () => {
            const room = createRoom(true);
            expect(VisibilityProvider.instance.isRoomVisible(room)).toBe(false);
        });

        it("should return false for a local room", () => {
            const room = createLocalRoom();
            expect(VisibilityProvider.instance.isRoomVisible(room)).toBe(false);
        });

        it("should return false if visibility customisation returns false", () => {
            mocked(RoomListCustomisations.isRoomVisible!).mockReturnValue(false);
            const room = createRoom();
            expect(VisibilityProvider.instance.isRoomVisible(room)).toBe(false);
            expect(RoomListCustomisations.isRoomVisible).toHaveBeenCalledWith(room);
        });

        it("should return true if visibility customisation returns true", () => {
            mocked(RoomListCustomisations.isRoomVisible!).mockReturnValue(true);
            const room = createRoom();
            expect(VisibilityProvider.instance.isRoomVisible(room)).toBe(true);
            expect(RoomListCustomisations.isRoomVisible).toHaveBeenCalledWith(room);
        });
    });
});

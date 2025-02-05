/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { type Room, type RoomMember, RoomType } from "matrix-js-sdk/src/matrix";

import { avatarUrlForRoom } from "../../src/Avatar";
import { type Media, mediaFromMxc } from "../../src/customisations/Media";
import DMRoomMap from "../../src/utils/DMRoomMap";

jest.mock("../../src/customisations/Media", () => ({
    mediaFromMxc: jest.fn(),
}));

const roomId = "!room:example.com";
const avatarUrl1 = "https://example.com/avatar1";
const avatarUrl2 = "https://example.com/avatar2";

describe("avatarUrlForRoom", () => {
    let getThumbnailOfSourceHttp: jest.Mock;
    let room: Room;
    let roomMember: RoomMember;
    let dmRoomMap: DMRoomMap;

    beforeEach(() => {
        getThumbnailOfSourceHttp = jest.fn();
        mocked(mediaFromMxc).mockImplementation((): Media => {
            return {
                getThumbnailOfSourceHttp,
            } as unknown as Media;
        });
        room = {
            roomId,
            getMxcAvatarUrl: jest.fn(),
            isSpaceRoom: jest.fn(),
            getType: jest.fn(),
            getAvatarFallbackMember: jest.fn(),
        } as unknown as Room;
        dmRoomMap = {
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap;
        DMRoomMap.setShared(dmRoomMap);
        roomMember = {
            getMxcAvatarUrl: jest.fn(),
        } as unknown as RoomMember;
    });

    it("should return null for a null room", () => {
        expect(avatarUrlForRoom(null, 128, 128)).toBeNull();
    });

    it("should return the HTTP source if the room provides a MXC url", () => {
        mocked(room.getMxcAvatarUrl).mockReturnValue(avatarUrl1);
        getThumbnailOfSourceHttp.mockReturnValue(avatarUrl2);
        expect(avatarUrlForRoom(room, 128, 256, "crop")).toEqual(avatarUrl2);
        expect(getThumbnailOfSourceHttp).toHaveBeenCalledWith(128, 256, "crop");
    });

    it("should return null for a space room", () => {
        mocked(room.isSpaceRoom).mockReturnValue(true);
        mocked(room.getType).mockReturnValue(RoomType.Space);
        expect(avatarUrlForRoom(room, 128, 128)).toBeNull();
    });

    it("should return null if the room is not a DM", () => {
        mocked(dmRoomMap).getUserIdForRoomId.mockReturnValue(null);
        expect(avatarUrlForRoom(room, 128, 128)).toBeNull();
        expect(dmRoomMap.getUserIdForRoomId).toHaveBeenCalledWith(roomId);
    });

    it("should return null if there is no other member in the room", () => {
        mocked(dmRoomMap).getUserIdForRoomId.mockReturnValue("@user:example.com");
        mocked(room.getAvatarFallbackMember).mockReturnValue(undefined);
        expect(avatarUrlForRoom(room, 128, 128)).toBeNull();
    });

    it("should return null if the other member has no avatar URL", () => {
        mocked(dmRoomMap).getUserIdForRoomId.mockReturnValue("@user:example.com");
        mocked(room.getAvatarFallbackMember).mockReturnValue(roomMember);
        expect(avatarUrlForRoom(room, 128, 128)).toBeNull();
    });

    it("should return the other member's avatar URL", () => {
        mocked(dmRoomMap).getUserIdForRoomId.mockReturnValue("@user:example.com");
        mocked(room.getAvatarFallbackMember).mockReturnValue(roomMember);
        mocked(roomMember.getMxcAvatarUrl).mockReturnValue(avatarUrl2);
        getThumbnailOfSourceHttp.mockReturnValue(avatarUrl2);
        expect(avatarUrlForRoom(room, 128, 256, "crop")).toEqual(avatarUrl2);
        expect(getThumbnailOfSourceHttp).toHaveBeenCalledWith(128, 256, "crop");
    });
});

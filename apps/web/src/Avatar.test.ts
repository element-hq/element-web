/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, describe, it, expect, beforeEach, type Mock } from "vitest";
import { type Room, type RoomMember, RoomType } from "matrix-js-sdk/src/matrix";

import { avatarUrlForRoom } from "./Avatar";
import { type Media, mediaFromMxc } from "./customisations/Media";
import DMRoomMap from "./utils/DMRoomMap";

vi.mock("./customisations/Media", () => ({
    mediaFromMxc: vi.fn(),
}));

const roomId = "!room:example.com";
const avatarUrl1 = "https://example.com/avatar1";
const avatarUrl2 = "https://example.com/avatar2";

describe("avatarUrlForRoom", () => {
    let getThumbnailOfSourceHttp: Mock;
    let room: Room;
    let roomMember: RoomMember;
    let dmRoomMap: DMRoomMap;

    beforeEach(() => {
        getThumbnailOfSourceHttp = vi.fn();
        vi.mocked(mediaFromMxc).mockImplementation((): Media => {
            return {
                getThumbnailOfSourceHttp,
            } as unknown as Media;
        });
        room = {
            roomId,
            getMxcAvatarUrl: vi.fn(),
            isSpaceRoom: vi.fn(),
            getType: vi.fn(),
            getAvatarFallbackMember: vi.fn(),
        } as unknown as Room;
        dmRoomMap = {
            getUserIdForRoomId: vi.fn(),
        } as unknown as DMRoomMap;
        DMRoomMap.setShared(dmRoomMap);
        roomMember = {
            getMxcAvatarUrl: vi.fn(),
        } as unknown as RoomMember;
    });

    it("should return null for a null room", () => {
        expect(avatarUrlForRoom(null, 128, 128)).toBeNull();
    });

    it("should return the HTTP source if the room provides a MXC url", () => {
        vi.mocked(room.getMxcAvatarUrl).mockReturnValue(avatarUrl1);
        getThumbnailOfSourceHttp.mockReturnValue(avatarUrl2);
        expect(avatarUrlForRoom(room, 128, 256, "crop")).toEqual(avatarUrl2);
        expect(getThumbnailOfSourceHttp).toHaveBeenCalledWith(128, 256, "crop");
    });

    it("should return null for a space room", () => {
        vi.mocked(room.isSpaceRoom).mockReturnValue(true);
        vi.mocked(room.getType).mockReturnValue(RoomType.Space);
        expect(avatarUrlForRoom(room, 128, 128)).toBeNull();
    });

    it("should return null if the room is not a DM", () => {
        vi.mocked(dmRoomMap).getUserIdForRoomId.mockReturnValue(undefined);
        expect(avatarUrlForRoom(room, 128, 128)).toBeNull();
        expect(dmRoomMap.getUserIdForRoomId).toHaveBeenCalledWith(roomId);
    });

    it("should return null if there is no other member in the room", () => {
        vi.mocked(dmRoomMap).getUserIdForRoomId.mockReturnValue("@user:example.com");
        vi.mocked(room.getAvatarFallbackMember).mockReturnValue(undefined);
        expect(avatarUrlForRoom(room, 128, 128)).toBeNull();
    });

    it("should return null if the other member has no avatar URL", () => {
        vi.mocked(dmRoomMap).getUserIdForRoomId.mockReturnValue("@user:example.com");
        vi.mocked(room.getAvatarFallbackMember).mockReturnValue(roomMember);
        expect(avatarUrlForRoom(room, 128, 128)).toBeNull();
    });

    it("should return the other member's avatar URL", () => {
        vi.mocked(dmRoomMap).getUserIdForRoomId.mockReturnValue("@user:example.com");
        vi.mocked(room.getAvatarFallbackMember).mockReturnValue(roomMember);
        vi.mocked(roomMember.getMxcAvatarUrl).mockReturnValue(avatarUrl2);
        getThumbnailOfSourceHttp.mockReturnValue(avatarUrl2);
        expect(avatarUrlForRoom(room, 128, 256, "crop")).toEqual(avatarUrl2);
        expect(getThumbnailOfSourceHttp).toHaveBeenCalledWith(128, 256, "crop");
    });
});

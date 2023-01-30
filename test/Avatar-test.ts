/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

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
import { Room, RoomMember, RoomType, User } from "matrix-js-sdk/src/matrix";

import {
    avatarUrlForMember,
    avatarUrlForRoom,
    avatarUrlForUser,
    defaultAvatarUrlForString,
    getColorForString,
    getInitialLetter,
} from "../src/Avatar";
import { mediaFromMxc } from "../src/customisations/Media";
import DMRoomMap from "../src/utils/DMRoomMap";
import { filterConsole, stubClient } from "./test-utils";

const roomId = "!room:example.com";
const avatarUrl1 = "https://example.com/avatar1";
const avatarUrl2 = "https://example.com/avatar2";

describe("avatarUrlForMember", () => {
    let member: RoomMember;

    beforeEach(() => {
        stubClient();
        member = new RoomMember(roomId, "@user:example.com");
    });

    it("returns the member's url", () => {
        const mxc = "mxc://example.com/a/b/c/d/avatar.gif";
        jest.spyOn(member, "getMxcAvatarUrl").mockReturnValue(mxc);

        expect(avatarUrlForMember(member, 32, 32, "crop")).toBe(
            mediaFromMxc(mxc).getThumbnailOfSourceHttp(32, 32, "crop"),
        );
    });

    it("returns a default if the member has no avatar", () => {
        jest.spyOn(member, "getMxcAvatarUrl").mockReturnValue(undefined);

        expect(avatarUrlForMember(member, 32, 32, "crop")).toMatch(/^data:/);
    });
});

describe("avatarUrlForUser", () => {
    let user: User;

    beforeEach(() => {
        stubClient();
        user = new User("@user:example.com");
    });

    it("should return the user's avatar", () => {
        const mxc = "mxc://example.com/a/b/c/d/avatar.gif";
        user.avatarUrl = mxc;

        expect(avatarUrlForUser(user, 64, 64, "scale")).toBe(
            mediaFromMxc(mxc).getThumbnailOfSourceHttp(64, 64, "scale"),
        );
    });

    it("should not provide a fallback", () => {
        expect(avatarUrlForUser(user, 64, 64, "scale")).toBeNull();
    });
});

describe("defaultAvatarUrlForString", () => {
    it.each(["a", "abc", "abcde", "@".repeat(150)])("should return a value for %s", (s) => {
        expect(defaultAvatarUrlForString(s)).not.toBe("");
    });
});

describe("getColorForString", () => {
    it.each(["a", "abc", "abcde", "@".repeat(150)])("should return a value for %s", (s) => {
        expect(getColorForString(s)).toMatch(/^#\w+$/);
    });

    it("should return different values for different strings", () => {
        expect(getColorForString("a")).not.toBe(getColorForString("b"));
    });
});

describe("getInitialLetter", () => {
    filterConsole("argument to `getInitialLetter` not supplied");

    it.each(["a", "abc", "abcde", "@".repeat(150)])("should return a value for %s", (s) => {
        expect(getInitialLetter(s)).not.toBe("");
    });

    it("should return undefined for empty strings", () => {
        expect(getInitialLetter("")).toBeUndefined();
    });
});

describe("avatarUrlForRoom", () => {
    let room: Room;
    let roomMember: RoomMember;
    let dmRoomMap: DMRoomMap;

    beforeEach(() => {
        stubClient();

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
        expect(avatarUrlForRoom(undefined, 128, 128)).toBeNull();
    });

    it("should return the HTTP source if the room provides a MXC url", () => {
        mocked(room.getMxcAvatarUrl).mockReturnValue(avatarUrl1);
        expect(avatarUrlForRoom(room, 128, 256, "crop")).toBe(
            mediaFromMxc(avatarUrl1).getThumbnailOfSourceHttp(128, 256, "crop"),
        );
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
        expect(avatarUrlForRoom(room, 128, 256, "crop")).toEqual(
            mediaFromMxc(avatarUrl2).getThumbnailOfSourceHttp(128, 256, "crop"),
        );
    });
});

/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { type MatrixClient, Room, RoomMember } from "matrix-js-sdk/src/matrix";

import { getFunctionalMembers } from "../../../../src/utils/room/getFunctionalMembers";
import { getJoinedNonFunctionalMembers } from "../../../../src/utils/room/getJoinedNonFunctionalMembers";

jest.mock("../../../../src/utils/room/getFunctionalMembers", () => ({
    getFunctionalMembers: jest.fn(),
}));

describe("getJoinedNonFunctionalMembers", () => {
    let room: Room;
    let roomMember1: RoomMember;
    let roomMember2: RoomMember;

    beforeEach(() => {
        room = new Room("!room:example.com", {} as unknown as MatrixClient, "@user:example.com");
        room.getJoinedMembers = jest.fn();

        roomMember1 = new RoomMember(room.roomId, "@user1:example.com");
        roomMember2 = new RoomMember(room.roomId, "@user2:example.com");
    });

    describe("if there are no members", () => {
        beforeEach(() => {
            mocked(room.getJoinedMembers).mockReturnValue([]);
            mocked(getFunctionalMembers).mockReturnValue([]);
        });

        it("should return an empty list", () => {
            expect(getJoinedNonFunctionalMembers(room)).toHaveLength(0);
        });
    });

    describe("if there are only regular room members", () => {
        beforeEach(() => {
            mocked(room.getJoinedMembers).mockReturnValue([roomMember1, roomMember2]);
            mocked(getFunctionalMembers).mockReturnValue([]);
        });

        it("should return the room members", () => {
            const members = getJoinedNonFunctionalMembers(room);
            expect(members).toContain(roomMember1);
            expect(members).toContain(roomMember2);
        });
    });

    describe("if there are only functional room members", () => {
        beforeEach(() => {
            mocked(room.getJoinedMembers).mockReturnValue([]);
            mocked(getFunctionalMembers).mockReturnValue(["@functional:example.com"]);
        });

        it("should return an empty list", () => {
            expect(getJoinedNonFunctionalMembers(room)).toHaveLength(0);
        });
    });

    describe("if there are some functional room members", () => {
        beforeEach(() => {
            mocked(room.getJoinedMembers).mockReturnValue([roomMember1, roomMember2]);
            mocked(getFunctionalMembers).mockReturnValue([roomMember1.userId]);
        });

        it("should only return the non-functional members", () => {
            const members = getJoinedNonFunctionalMembers(room);
            expect(members).not.toContain(roomMember1);
            expect(members).toContain(roomMember2);
        });
    });
});

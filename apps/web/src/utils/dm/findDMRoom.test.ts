/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import { type MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { createTestClient } from "test-utils";

import { MatrixClientPeg } from "../../MatrixClientPeg";
import { DirectoryMember, ThreepidMember } from "../direct-messages";
import { findDMForUser } from "./findDMForUser";
import { findDMRoom } from "./findDMRoom";
import DMRoomMap from "../DMRoomMap";

vi.mock("../dm/findDMForUser", () => ({
    findDMForUser: vi.fn(),
}));

describe("findDMRoom", () => {
    const userId1 = "@user1:example.com";
    const member1 = new DirectoryMember({ user_id: userId1 });
    const member2 = new ThreepidMember("user2");
    let mockClient: MatrixClient;
    let room1: Room;
    let dmRoomMap: DMRoomMap;

    beforeEach(() => {
        mockClient = createTestClient();
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        room1 = new Room("!room1:example.com", mockClient, userId1);

        dmRoomMap = {
            getDMRoomForIdentifiers: vi.fn(),
            getDMRoomsForUserId: vi.fn(),
        } as unknown as DMRoomMap;
        vi.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
    });

    it("should return the room for a single target with a room", () => {
        vi.mocked(findDMForUser).mockReturnValue(room1);
        expect(findDMRoom(mockClient, [member1])).toBe(room1);
    });

    it("should return undefined for a single target without a room", () => {
        vi.mocked(findDMForUser).mockReturnValue(undefined);
        expect(findDMRoom(mockClient, [member1])).toBeNull();
    });

    it("should return the room for 2 targets with a room", () => {
        vi.mocked(dmRoomMap.getDMRoomForIdentifiers).mockReturnValue(room1);
        expect(findDMRoom(mockClient, [member1, member2])).toBe(room1);
    });

    it("should return null for 2 targets without a room", () => {
        vi.mocked(dmRoomMap.getDMRoomForIdentifiers).mockReturnValue(null);
        expect(findDMRoom(mockClient, [member1, member2])).toBeNull();
    });
});

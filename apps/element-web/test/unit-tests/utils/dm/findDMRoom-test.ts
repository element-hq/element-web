/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { type MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { DirectoryMember, ThreepidMember } from "../../../../src/utils/direct-messages";
import { findDMForUser } from "../../../../src/utils/dm/findDMForUser";
import { findDMRoom } from "../../../../src/utils/dm/findDMRoom";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { createTestClient } from "../../../test-utils";

jest.mock("../../../../src/utils/dm/findDMForUser", () => ({
    findDMForUser: jest.fn(),
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
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        room1 = new Room("!room1:example.com", mockClient, userId1);

        dmRoomMap = {
            getDMRoomForIdentifiers: jest.fn(),
            getDMRoomsForUserId: jest.fn(),
        } as unknown as DMRoomMap;
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
    });

    it("should return the room for a single target with a room", () => {
        mocked(findDMForUser).mockReturnValue(room1);
        expect(findDMRoom(mockClient, [member1])).toBe(room1);
    });

    it("should return undefined for a single target without a room", () => {
        mocked(findDMForUser).mockReturnValue(undefined);
        expect(findDMRoom(mockClient, [member1])).toBeNull();
    });

    it("should return the room for 2 targets with a room", () => {
        mocked(dmRoomMap.getDMRoomForIdentifiers).mockReturnValue(room1);
        expect(findDMRoom(mockClient, [member1, member2])).toBe(room1);
    });

    it("should return null for 2 targets without a room", () => {
        mocked(dmRoomMap.getDMRoomForIdentifiers).mockReturnValue(null);
        expect(findDMRoom(mockClient, [member1, member2])).toBeNull();
    });
});

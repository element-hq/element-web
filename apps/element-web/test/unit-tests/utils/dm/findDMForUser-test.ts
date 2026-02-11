/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { type MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { createTestClient, makeMembershipEvent, mkThirdPartyInviteEvent } from "../../../test-utils";
import { LocalRoom } from "../../../../src/models/LocalRoom";
import { findDMForUser } from "../../../../src/utils/dm/findDMForUser";
import { getFunctionalMembers } from "../../../../src/utils/room/getFunctionalMembers";

jest.mock("../../../../src/utils/room/getFunctionalMembers", () => ({
    getFunctionalMembers: jest.fn(),
}));

describe("findDMForUser", () => {
    const userId1 = "@user1:example.com";
    const userId2 = "@user2:example.com";
    const userId3 = "@user3:example.com";
    const botId = "@bot:example.com";
    const thirdPartyId = "party@example.com";
    let room1: Room;
    let room2: LocalRoom;
    let room3: Room;
    let room4: Room;
    let room5: Room;
    let room6: Room;
    let room7: Room;
    const unknownRoomId = "!unknown:example.com";
    let dmRoomMap: DMRoomMap;
    let mockClient: MatrixClient;

    beforeEach(() => {
        mockClient = createTestClient();

        // always return the bot user as functional member
        mocked(getFunctionalMembers).mockReturnValue([botId]);

        room1 = new Room("!room1:example.com", mockClient, userId1);
        room1.getMyMembership = () => KnownMembership.Join;
        room1.currentState.setStateEvents([
            makeMembershipEvent(room1.roomId, userId1, KnownMembership.Join),
            makeMembershipEvent(room1.roomId, userId2, KnownMembership.Join),
        ]);

        // this should not be a DM room because it is a local room
        room2 = new LocalRoom("!room2:example.com", mockClient, userId1);
        room2.getMyMembership = () => KnownMembership.Join;
        room2.getLastActiveTimestamp = () => 100;

        room3 = new Room("!room3:example.com", mockClient, userId1);
        room3.getMyMembership = () => KnownMembership.Join;
        room3.currentState.setStateEvents([
            makeMembershipEvent(room3.roomId, userId1, KnownMembership.Join),
            makeMembershipEvent(room3.roomId, userId2, KnownMembership.Join),
            // Adding the bot user here. Should be excluded when determining if the room is a DM.
            makeMembershipEvent(room3.roomId, botId, KnownMembership.Join),
        ]);

        // this should not be a DM room because it has only one joined user
        room4 = new Room("!room4:example.com", mockClient, userId1);
        room4.getMyMembership = () => KnownMembership.Join;
        room4.currentState.setStateEvents([
            makeMembershipEvent(room4.roomId, userId1, KnownMembership.Invite),
            makeMembershipEvent(room4.roomId, userId2, KnownMembership.Join),
        ]);

        // this should not be a DM room because it has no users
        room5 = new Room("!room5:example.com", mockClient, userId1);
        room5.getLastActiveTimestamp = () => 100;

        // room not correctly stored in userId → room map; should be found by the "all rooms" fallback
        room6 = new Room("!room6:example.com", mockClient, userId1);
        room6.getMyMembership = () => KnownMembership.Join;
        room6.currentState.setStateEvents([
            makeMembershipEvent(room6.roomId, userId1, KnownMembership.Join),
            makeMembershipEvent(room6.roomId, userId3, KnownMembership.Join),
        ]);

        // room with pending third-party invite
        room7 = new Room("!room7:example.com", mockClient, userId1);
        room7.getMyMembership = () => KnownMembership.Join;
        room7.currentState.setStateEvents([
            makeMembershipEvent(room7.roomId, userId1, KnownMembership.Join),
            mkThirdPartyInviteEvent(thirdPartyId, "third-party", room7.roomId),
        ]);

        mocked(mockClient.getRoom).mockImplementation((roomId: string) => {
            return (
                {
                    [room1.roomId]: room1,
                    [room2.roomId]: room2,
                    [room3.roomId]: room3,
                    [room4.roomId]: room4,
                    [room5.roomId]: room5,
                    [room6.roomId]: room6,
                    [room7.roomId]: room7,
                }[roomId] || null
            );
        });

        dmRoomMap = {
            getDMRoomForIdentifiers: jest.fn(),
            getDMRoomsForUserId: jest.fn(),
            getRoomIds: jest.fn().mockReturnValue(
                new Set([
                    room1.roomId,
                    room2.roomId,
                    room3.roomId,
                    room4.roomId,
                    room5.roomId,
                    room6.roomId,
                    room7.roomId,
                    unknownRoomId, // this room does not exist in client
                ]),
            ),
        } as unknown as DMRoomMap;
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
        mocked(dmRoomMap.getDMRoomsForUserId).mockImplementation((userId: string) => {
            if (userId === userId1) {
                return [room1.roomId, room2.roomId, room3.roomId, room4.roomId, room5.roomId, unknownRoomId];
            }

            if (userId === thirdPartyId) {
                return [room7.roomId];
            }

            return [];
        });
    });

    describe("for an empty DM room list", () => {
        beforeEach(() => {
            mocked(dmRoomMap.getDMRoomsForUserId).mockReturnValue([]);
            mocked(dmRoomMap.getRoomIds).mockReturnValue(new Set());
        });

        it("should return undefined", () => {
            expect(findDMForUser(mockClient, userId1)).toBeUndefined();
        });
    });

    it("should find a room ordered by last activity 1", () => {
        room1.getLastActiveTimestamp = () => 2;
        room3.getLastActiveTimestamp = () => 1;

        expect(findDMForUser(mockClient, userId1)).toBe(room1);
    });

    it("should find a room ordered by last activity 2", () => {
        room1.getLastActiveTimestamp = () => 1;
        room3.getLastActiveTimestamp = () => 2;

        expect(findDMForUser(mockClient, userId1)).toBe(room3);
    });

    it("should find a room by the 'all rooms' fallback", () => {
        room1.getLastActiveTimestamp = () => 1;
        room6.getLastActiveTimestamp = () => 2;

        expect(findDMForUser(mockClient, userId3)).toBe(room6);
    });

    it("should find a room with a pending third-party invite", () => {
        expect(findDMForUser(mockClient, thirdPartyId)).toBe(room7);
    });

    it("should not find a room for an unknown Id", () => {
        expect(findDMForUser(mockClient, "@unknown:example.com")).toBe(undefined);
    });
});

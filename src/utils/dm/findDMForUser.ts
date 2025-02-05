/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import DMRoomMap from "../DMRoomMap";
import { isLocalRoom } from "../localRoom/isLocalRoom";
import { isJoinedOrNearlyJoined } from "../membership";
import { getFunctionalMembers } from "../room/getFunctionalMembers";

/**
 * Iterates the rooms and tries to find a DM room with the user identified by UserId.
 * A DM room is assumed if one of the following matches:
 * - Has two members and contains a membership for the user identified by userId
 * - findRoomWithThirdpartyInvites is true and has one member and a third pending third party invite
 *
 * If multiple rooms match it will return the one with the most recent event.
 *
 * @param rooms - Rooms to iterate
 * @param userId - User Id of the other user
 * @param [findRoomWithThirdpartyInvites] - Whether to find a DM for a pending thirdparty invite
 * @returns DM room if found or undefined if not
 */
function extractSuitableRoom(rooms: Room[], userId: string, findRoomWithThirdpartyInvites: boolean): Room | undefined {
    const suitableRooms = rooms
        .filter((r) => {
            // Validate that we are joined and the other person is also joined. We'll also make sure
            // that the room also looks like a DM (until we have canonical DMs to tell us). For now,
            // a DM is a room of two people that contains those two people exactly. This does mean
            // that bots, assistants, etc will ruin a room's DM-ness, though this is a problem for
            // canonical DMs to solve.
            if (r && r.getMyMembership() === KnownMembership.Join) {
                if (isLocalRoom(r)) return false;

                const functionalUsers = getFunctionalMembers(r);
                const members = r.currentState.getMembers();
                const joinedMembers = members.filter(
                    (m) => !functionalUsers.includes(m.userId) && m.membership && isJoinedOrNearlyJoined(m.membership),
                );
                const otherMember = joinedMembers.find((m) => m.userId === userId);

                if (otherMember && joinedMembers.length === 2) {
                    return true;
                }

                const thirdPartyInvites = r.currentState.getStateEvents("m.room.third_party_invite") || [];

                // match room with pending third-party invite
                return findRoomWithThirdpartyInvites && joinedMembers.length === 1 && thirdPartyInvites.length === 1;
            }
            return false;
        })
        .sort((r1, r2) => {
            return r2.getLastActiveTimestamp() - r1.getLastActiveTimestamp();
        });

    if (suitableRooms.length) {
        return suitableRooms[0];
    }

    return undefined;
}

/**
 * Tries to find a DM room with a specific user.
 *
 * @param {MatrixClient} client
 * @param {string} userId ID of the user to find the DM for
 * @returns {Room | undefined} Room if found
 */
export function findDMForUser(client: MatrixClient, userId: string): Room | undefined {
    const roomIdsForUserId = DMRoomMap.shared().getDMRoomsForUserId(userId);
    const roomsForUserId = roomIdsForUserId.map((id) => client.getRoom(id)).filter((r): r is Room => r !== null);
    // Call with findRoomWithThirdpartyInvites = true to also include rooms with pending thirdparty invites.
    // roomsForUserId can only contain rooms with the other user here,
    // because they have been queried by getDMRoomsForUserId().
    const suitableRoomForUserId = extractSuitableRoom(roomsForUserId, userId, true);

    if (suitableRoomForUserId) {
        return suitableRoomForUserId;
    }

    // Try to find in all rooms as a fallback
    const allRoomIds = DMRoomMap.shared().getRoomIds();
    const allRooms = Array.from(allRoomIds)
        .map((id) => client.getRoom(id))
        .filter((r): r is Room => r !== null);
    return extractSuitableRoom(allRooms, userId, false);
}

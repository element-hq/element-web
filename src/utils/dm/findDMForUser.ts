/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import DMRoomMap from "../DMRoomMap";
import { isLocalRoom } from "../localRoom/isLocalRoom";
import { isJoinedOrNearlyJoined } from "../membership";
import { getFunctionalMembers } from "../room/getFunctionalMembers";

/**
 * Tries to find a DM room with a specific user.
 *
 * @param {MatrixClient} client
 * @param {string} userId ID of the user to find the DM for
 * @returns {Room} Room if found
 */
export function findDMForUser(client: MatrixClient, userId: string): Room {
    const roomIds = DMRoomMap.shared().getDMRoomsForUserId(userId);
    const rooms = roomIds.map(id => client.getRoom(id));
    const suitableDMRooms = rooms.filter(r => {
        // Validate that we are joined and the other person is also joined. We'll also make sure
        // that the room also looks like a DM (until we have canonical DMs to tell us). For now,
        // a DM is a room of two people that contains those two people exactly. This does mean
        // that bots, assistants, etc will ruin a room's DM-ness, though this is a problem for
        // canonical DMs to solve.
        if (r && r.getMyMembership() === "join") {
            if (isLocalRoom(r)) return false;

            const functionalUsers = getFunctionalMembers(r);
            const members = r.currentState.getMembers();
            const joinedMembers = members.filter(
                m => !functionalUsers.includes(m.userId) && isJoinedOrNearlyJoined(m.membership),
            );
            const otherMember = joinedMembers.find(m => m.userId === userId);
            return otherMember && joinedMembers.length === 2;
        }
        return false;
    }).sort((r1, r2) => {
        return r2.getLastActiveTimestamp() -
            r1.getLastActiveTimestamp();
    });
    if (suitableDMRooms.length) {
        return suitableDMRooms[0];
    }
}

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

import { Member } from "../direct-messages";
import DMRoomMap from "../DMRoomMap";
import { findDMForUser } from "./findDMForUser";

/**
 * Tries to find a DM room with some other users.
 *
 * @param {MatrixClient} client
 * @param {Member[]} targets The Members to try to find the room for
 * @returns {Room | null} Resolved so the room if found, else null
 */
export function findDMRoom(client: MatrixClient, targets: Member[]): Room | null {
    const targetIds = targets.map((t) => t.userId);
    let existingRoom: Room | null;
    if (targetIds.length === 1) {
        existingRoom = findDMForUser(client, targetIds[0]) ?? null;
    } else {
        existingRoom = DMRoomMap.shared().getDMRoomForIdentifiers(targetIds);
    }
    return existingRoom;
}

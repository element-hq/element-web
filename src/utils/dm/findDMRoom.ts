/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import { type Member } from "../direct-messages";
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

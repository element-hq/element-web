/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";

import { isLocalRoom } from "../../utils/localRoom/isLocalRoom";
import { RoomListCustomisations } from "../../customisations/RoomList";

/**
 * Determines whether a room should be visible in the room list
 * @param room - The room to check for visibility
 */
export function isRoomVisible(room?: Room): boolean {
    if (!room) return false;

    // hide space rooms as they'll be shown in the SpacePanel
    if (room.isSpaceRoom()) return false;

    // local rooms shouldn't show up anywhere
    if (isLocalRoom(room)) return false;

    if (RoomListCustomisations.isRoomVisible) return RoomListCustomisations.isRoomVisible(room);

    return true; // default
}

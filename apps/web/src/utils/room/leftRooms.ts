/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room, RoomEvent } from "matrix-js-sdk/src/matrix";

/**
 * Rooms we have successfully left, but whose leave has not come down sync yet.
 * Until it does, {@link Room.getMyMembership} still reports "join" for them.
 */
const leftRoomIds = new Set<string>();

/**
 * Remembers that we have left the room, until sync next updates our membership in it.
 */
export function markRoomAsLeft(room: Room): void {
    if (leftRoomIds.has(room.roomId)) return;
    leftRoomIds.add(room.roomId);
    room.once(RoomEvent.MyMembership, () => leftRoomIds.delete(room.roomId));
}

/**
 * Whether we have left the room and sync has not caught up with it yet.
 */
export function isRoomLeftPendingSync(roomId: string): boolean {
    return leftRoomIds.has(roomId);
}

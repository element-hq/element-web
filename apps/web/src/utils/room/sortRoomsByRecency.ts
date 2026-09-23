/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import { getLastTimestamp } from "../../stores/room-list-v3/skip-list/sorters/utils/getLastTimestamp";

/**
 * Sort an arbitrary list of rooms by recency (most recent activity first).
 *
 * Unlike the main room list sorting, this is a pure recency sort: muted and
 * low-priority rooms are NOT moved to the bottom. The provided array is not
 * mutated; a sorted copy is returned. The given list is sorted as-is and is
 * not filtered by the active space.
 * @param rooms The rooms to sort.
 * @param userId The mxId of the current user.
 */
export function sortRoomsByRecency(rooms: Room[], userId: string): Room[] {
    const cache = new Map<string, number>();
    const ts = (room: Room): number => {
        let value = cache.get(room.roomId);
        if (value === undefined) {
            value = getLastTimestamp(room, userId);
            cache.set(room.roomId, value);
        }
        return value;
    };
    return [...rooms].sort((a, b) => ts(b) - ts(a));
}

/**
 * Compare two rooms by recency, most recent activity first.
 *
 * Intended for sorting mixed result sets where rooms need to be ordered
 * relative to each other (e.g. spotlight search results).
 * @param roomA The first room.
 * @param roomB The second room.
 * @param userId The mxId of the current user.
 */
export function compareRoomsByRecency(roomA: Room, roomB: Room, userId: string): number {
    return getLastTimestamp(roomB, userId) - getLastTimestamp(roomA, userId);
}

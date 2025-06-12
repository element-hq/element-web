/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import { type Sorter, SortingAlgorithm } from ".";
import { getLastTs } from "../../../room-list/algorithms/tag-sorting/RecentAlgorithm";
import { RoomNotificationStateStore } from "../../../notifications/RoomNotificationStateStore";
import { DefaultTagID } from "../../../room-list/models";

export class RecencySorter implements Sorter {
    public constructor(private myUserId: string) {}

    public sort(rooms: Room[]): Room[] {
        const tsCache: { [roomId: string]: number } = {};
        return [...rooms].sort((a, b) => this.comparator(a, b, tsCache));
    }

    public comparator(roomA: Room, roomB: Room, cache?: any): number {
        // First check if the rooms are low priority or muted
        const exceptionalOrdering = this.getScore(roomA) - this.getScore(roomB);
        if (exceptionalOrdering !== 0) return exceptionalOrdering;

        // Then check recency; recent rooms should be at the top
        const roomALastTs = this.getTs(roomA, cache);
        const roomBLastTs = this.getTs(roomB, cache);
        return roomBLastTs - roomALastTs;
    }

    public get type(): SortingAlgorithm.Recency {
        return SortingAlgorithm.Recency;
    }

    /**
     * This sorter mostly sorts rooms by recency but there are two exceptions:
     * 1. Muted rooms are sorted to the bottom of the list.
     * 2. Low priority rooms are sorted to the bottom of the list but before muted rooms.
     *
     * The following method provides a numerical value that takes care of this
     * exceptional ordering. For two rooms A and B, it works as follows:
     * - If getScore(A) - getScore(B) > 0, A should come after B
     * - If getScore(A) - getScore(B) < 0, A should come before B
     * - If getScore(A) - getScore(B) = 0, no special ordering needed, just use recency
     */
    private getScore(room: Room): number {
        const isLowPriority = !!room.tags[DefaultTagID.LowPriority];
        const isMuted = RoomNotificationStateStore.instance.getRoomState(room).muted;
        // These constants are chosen so that the following order is maintained:
        // Low priority rooms -> Low priority and muted rooms -> Muted rooms
        if (isMuted && isLowPriority) return 5;
        else if (isMuted) return 10;
        else if (isLowPriority) return 2;
        else return 0;
    }

    private getTs(room: Room, cache?: { [roomId: string]: number }): number {
        const ts = cache?.[room.roomId] ?? getLastTs(room, this.myUserId);
        if (cache) {
            cache[room.roomId] = ts;
        }
        return ts;
    }
}

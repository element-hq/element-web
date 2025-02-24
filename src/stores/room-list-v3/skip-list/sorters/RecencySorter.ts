/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import type { Sorter } from ".";
import { getLastTs } from "../../../room-list/algorithms/tag-sorting/RecentAlgorithm";

export class RecencySorter implements Sorter {
    public constructor(private myUserId: string) {}

    public sort(rooms: Room[]): Room[] {
        const tsCache: { [roomId: string]: number } = {};
        return [...rooms].sort((a, b) => this.comparator(a, b, tsCache));
    }

    public comparator(roomA: Room, roomB: Room, cache?: any): number {
        const roomALastTs = this.getTs(roomA, cache);
        const roomBLastTs = this.getTs(roomB, cache);
        return roomBLastTs - roomALastTs;
    }

    private getTs(room: Room, cache?: { [roomId: string]: number }): number {
        const ts = cache?.[room.roomId] ?? getLastTs(room, this.myUserId);
        if (cache) {
            cache[room.roomId] = ts;
        }
        return ts;
    }
}

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import type { Sorter, SortingAlgorithm } from ".";
import { getLastTs } from "../../../room-list/algorithms/tag-sorting/RecentAlgorithm";

export abstract class BaseRecencySorter implements Sorter {
    public constructor(protected myUserId: string) {}

    public sort(rooms: Room[]): Room[] {
        const tsCache: { [roomId: string]: number } = {};
        return [...rooms].sort((a, b) => this.comparator(a, b, tsCache));
    }

    public comparator(roomA: Room, roomB: Room, cache?: any): number {
        // First check if any of the rooms are special cases
        const exceptionalOrdering = this.getScore(roomA) - this.getScore(roomB);
        if (exceptionalOrdering !== 0) return exceptionalOrdering;

        // Then check recency; recent rooms should be at the top
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

    public abstract get type(): SortingAlgorithm;

    /**
     * Rooms are sorted based on:
     * - the score of the room
     * - the timestamp of the last message in that room
     *
     * The score takes precedence over the timestamp of the last message. This allows
     * some rooms to be sorted before/after others regardless of when the last message
     * was received in that room. Eg: muted rooms can be placed at the bottom of the list
     * even if they received messages recently.
     */
    protected abstract getScore(room: Room): number;
}

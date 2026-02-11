/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import type { RoomNode } from "./RoomNode";
import type { FilterKey } from "./filters";

export class SortedRoomIterator implements Iterator<Room> {
    public constructor(private current: RoomNode) {}

    public next(): IteratorResult<Room> {
        const current = this.current;
        if (!current) return { value: undefined, done: true };
        this.current = current.next[0];
        return {
            value: current.room,
        };
    }
}

export class SortedSpaceFilteredIterator implements Iterator<Room> {
    public constructor(
        private current: RoomNode,
        private readonly filters: FilterKey[],
    ) {}

    public [Symbol.iterator](): SortedSpaceFilteredIterator {
        return this;
    }

    public next(): IteratorResult<Room> {
        let current = this.current;
        while (current) {
            if (current.isInActiveSpace && current.doesRoomMatchFilters(this.filters)) break;
            current = current.next[0];
        }
        if (!current) return { value: undefined, done: true };
        this.current = current.next[0];
        return {
            value: current.room,
        };
    }
}

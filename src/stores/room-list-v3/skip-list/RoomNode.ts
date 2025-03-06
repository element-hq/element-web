/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import type { Filter, FilterKey } from "./filters";
import SpaceStore from "../../spaces/SpaceStore";

/**
 * Room skip list stores room nodes.
 * These hold the actual room object and provides references to other nodes
 * in different levels.
 */
export class RoomNode {
    private _isInActiveSpace: boolean = false;

    public constructor(public readonly room: Room) {}

    /**
     * This array holds references to the next node in a given level.
     * eg: next[i] gives the next room node from this room node in level i.
     */
    public next: RoomNode[] = [];

    /**
     * This array holds references to the previous node in a given level.
     * eg: previous[i] gives the previous room node from this room node in level i.
     */
    public previous: RoomNode[] = [];

    /**
     * Whether the room associated with this room node belongs to
     * the currently active space.
     * @see {@link SpaceStoreClass#activeSpace} to understand what active
     * space means.
     */
    public get isInActiveSpace(): boolean {
        return this._isInActiveSpace;
    }

    /**
     * Check if this room belongs to the active space and store the result
     * in {@link RoomNode#isInActiveSpace}.
     */
    public checkIfRoomBelongsToActiveSpace(): void {
        const activeSpace = SpaceStore.instance.activeSpace;
        this._isInActiveSpace = SpaceStore.instance.isRoomInSpace(activeSpace, this.room.roomId);
    }

    /**
     * Aggregates all the filter keys that apply to this room.
     * eg: if filterKeysSet.has(Filter.FavouriteFilter) is true, then this room is a favourite room.
     */
    private filterKeysSet: Set<FilterKey> = new Set();

    /**
     * Returns true if the associated room matches all the provided filters.
     * Returns false otherwise.
     * @param filterKeys An array of filter keys to check against.
     */
    public doesRoomMatchFilters(filterKeys: FilterKey[]): boolean {
        return !filterKeys.some((key) => !this.filterKeysSet.has(key));
    }

    /**
     * Populates {@link RoomNode#filterKeysSet} by checking if the associated room
     * satisfies the given filters.
     * @param filters A list of filters
     */
    public applyFilters(filters: Filter[]): void {
        this.filterKeysSet = new Set();
        for (const filter of filters) {
            if (filter.matches(this.room)) this.filterKeysSet.add(filter.key);
        }
    }
}

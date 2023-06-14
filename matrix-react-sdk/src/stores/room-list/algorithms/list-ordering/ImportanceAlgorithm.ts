/*
Copyright 2018, 2019 New Vector Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { Room } from "matrix-js-sdk/src/models/room";
import { logger } from "matrix-js-sdk/src/logger";

import { RoomUpdateCause, TagID } from "../../models";
import { SortAlgorithm } from "../models";
import { sortRoomsWithAlgorithm } from "../tag-sorting";
import { OrderingAlgorithm } from "./OrderingAlgorithm";
import { NotificationColor } from "../../../notifications/NotificationColor";
import { RoomNotificationStateStore } from "../../../notifications/RoomNotificationStateStore";

type CategorizedRoomMap = {
    [category in NotificationColor]: Room[];
};

type CategoryIndex = Partial<{
    [category in NotificationColor]: number; // integer
}>;

// Caution: changing this means you'll need to update a bunch of assumptions and
// comments! Check the usage of Category carefully to figure out what needs changing
// if you're going to change this array's order.
const CATEGORY_ORDER = [
    NotificationColor.Unsent,
    NotificationColor.Red,
    NotificationColor.Grey,
    NotificationColor.Bold,
    NotificationColor.None, // idle
    NotificationColor.Muted,
];

/**
 * An implementation of the "importance" algorithm for room list sorting. Where
 * the tag sorting algorithm does not interfere, rooms will be ordered into
 * categories of varying importance to the user. Alphabetical sorting does not
 * interfere with this algorithm, however manual ordering does.
 *
 * The importance of a room is defined by the kind of notifications, if any, are
 * present on the room. These are classified internally as Unsent, Red, Grey,
 * Bold, and Idle. 'Unsent' rooms have unsent messages, Red rooms have mentions,
 * grey have unread messages, bold is a less noisy version of grey, and idle
 * means all activity has been seen by the user.
 *
 * The algorithm works by monitoring all room changes, including new messages in
 * tracked rooms, to determine if it needs a new category or different placement
 * within the same category. For more information, see the comments contained
 * within the class.
 */
export class ImportanceAlgorithm extends OrderingAlgorithm {
    // This tracks the category for the tag it represents by tracking the index of
    // each category within the list, where zero is the top of the list. This then
    // tracks when rooms change categories and splices the orderedRooms array as
    // needed, preventing many ordering operations.

    private indices: CategoryIndex = {};

    public constructor(tagId: TagID, initialSortingAlgorithm: SortAlgorithm) {
        super(tagId, initialSortingAlgorithm);
    }

    // noinspection JSMethodCanBeStatic
    private categorizeRooms(rooms: Room[]): CategorizedRoomMap {
        const map: CategorizedRoomMap = {
            [NotificationColor.Unsent]: [],
            [NotificationColor.Red]: [],
            [NotificationColor.Grey]: [],
            [NotificationColor.Bold]: [],
            [NotificationColor.None]: [],
            [NotificationColor.Muted]: [],
        };
        for (const room of rooms) {
            const category = this.getRoomCategory(room);
            map[category]?.push(room);
        }
        return map;
    }

    // noinspection JSMethodCanBeStatic
    private getRoomCategory(room: Room): NotificationColor {
        // It's fine for us to call this a lot because it's cached, and we shouldn't be
        // wasting anything by doing so as the store holds single references
        const state = RoomNotificationStateStore.instance.getRoomState(room);
        return this.isMutedToBottom && state.muted ? NotificationColor.Muted : state.color;
    }

    public setRooms(rooms: Room[]): void {
        if (this.sortingAlgorithm === SortAlgorithm.Manual) {
            this.cachedOrderedRooms = sortRoomsWithAlgorithm(rooms, this.tagId, this.sortingAlgorithm);
        } else {
            // Every other sorting type affects the categories, not the whole tag.
            const categorized = this.categorizeRooms(rooms);
            for (const category of Object.keys(categorized)) {
                const notificationColor = category as unknown as NotificationColor;
                const roomsToOrder = categorized[notificationColor];
                categorized[notificationColor] = sortRoomsWithAlgorithm(
                    roomsToOrder,
                    this.tagId,
                    this.sortingAlgorithm,
                );
            }

            const newlyOrganized: Room[] = [];
            const newIndices: CategoryIndex = {};

            for (const category of CATEGORY_ORDER) {
                newIndices[category] = newlyOrganized.length;
                newlyOrganized.push(...categorized[category]);
            }

            this.indices = newIndices;
            this.cachedOrderedRooms = newlyOrganized;
        }
    }

    private getCategoryIndex(category: NotificationColor): number {
        const categoryIndex = this.indices[category];

        if (categoryIndex === undefined) {
            throw new Error(`Index of category ${category} not found`);
        }

        return categoryIndex;
    }

    private handleSplice(room: Room, cause: RoomUpdateCause): boolean {
        if (cause === RoomUpdateCause.NewRoom) {
            const category = this.getRoomCategory(room);
            this.alterCategoryPositionBy(category, 1, this.indices);
            this.cachedOrderedRooms.splice(this.getCategoryIndex(category), 0, room); // splice in the new room (pre-adjusted)
            this.sortCategory(category);
        } else if (cause === RoomUpdateCause.RoomRemoved) {
            const roomIdx = this.getRoomIndex(room);
            if (roomIdx === -1) {
                logger.warn(`Tried to remove unknown room from ${this.tagId}: ${room.roomId}`);
                return false; // no change
            }
            const oldCategory = this.getCategoryFromIndices(roomIdx, this.indices);
            this.alterCategoryPositionBy(oldCategory, -1, this.indices);
            this.cachedOrderedRooms.splice(roomIdx, 1); // remove the room
        } else {
            throw new Error(`Unhandled splice: ${cause}`);
        }

        // changes have been made if we made it here, so say so
        return true;
    }

    public handleRoomUpdate(room: Room, cause: RoomUpdateCause): boolean {
        if (cause === RoomUpdateCause.NewRoom || cause === RoomUpdateCause.RoomRemoved) {
            return this.handleSplice(room, cause);
        }

        if (
            cause !== RoomUpdateCause.Timeline &&
            cause !== RoomUpdateCause.ReadReceipt &&
            cause !== RoomUpdateCause.PossibleMuteChange
        ) {
            throw new Error(`Unsupported update cause: ${cause}`);
        }

        // don't react to mute changes when we are not sorting by mute
        if (cause === RoomUpdateCause.PossibleMuteChange && !this.isMutedToBottom) {
            return false;
        }

        if (this.sortingAlgorithm === SortAlgorithm.Manual) {
            return false; // Nothing to do here.
        }

        const category = this.getRoomCategory(room);

        const roomIdx = this.getRoomIndex(room);
        if (roomIdx === -1) {
            throw new Error(`Room ${room.roomId} has no index in ${this.tagId}`);
        }

        // Try to avoid doing array operations if we don't have to: only move rooms within
        // the categories if we're jumping categories
        const oldCategory = this.getCategoryFromIndices(roomIdx, this.indices);
        if (oldCategory !== category) {
            // Move the room and update the indices
            this.moveRoomIndexes(1, oldCategory, category, this.indices);
            this.cachedOrderedRooms.splice(roomIdx, 1); // splice out the old index (fixed position)
            this.cachedOrderedRooms.splice(this.getCategoryIndex(category), 0, room); // splice in the new room (pre-adjusted)
            // Note: if moveRoomIndexes() is called after the splice then the insert operation
            // will happen in the wrong place. Because we would have already adjusted the index
            // for the category, we don't need to determine how the room is moving in the list.
            // If we instead tried to insert before updating the indices, we'd have to determine
            // whether the room was moving later (towards IDLE) or earlier (towards RED) from its
            // current position, as it'll affect the category's start index after we remove the
            // room from the array.
        }

        // Sort the category now that we've dumped the room in
        this.sortCategory(category);

        return true; // change made
    }

    private sortCategory(category: NotificationColor): void {
        // This should be relatively quick because the room is usually inserted at the top of the
        // category, and most popular sorting algorithms will deal with trying to keep the active
        // room at the top/start of the category. For the few algorithms that will have to move the
        // thing quite far (alphabetic with a Z room for example), the list should already be sorted
        // well enough that it can rip through the array and slot the changed room in quickly.
        const nextCategoryStartIdx =
            category === CATEGORY_ORDER[CATEGORY_ORDER.length - 1]
                ? Number.MAX_SAFE_INTEGER
                : this.getCategoryIndex(CATEGORY_ORDER[CATEGORY_ORDER.indexOf(category) + 1]);
        const startIdx = this.getCategoryIndex(category);
        const numSort = nextCategoryStartIdx - startIdx; // splice() returns up to the max, so MAX_SAFE_INT is fine
        const unsortedSlice = this.cachedOrderedRooms.splice(startIdx, numSort);
        const sorted = sortRoomsWithAlgorithm(unsortedSlice, this.tagId, this.sortingAlgorithm);
        this.cachedOrderedRooms.splice(startIdx, 0, ...sorted);
    }

    // noinspection JSMethodCanBeStatic
    private getCategoryFromIndices(index: number, indices: CategoryIndex): NotificationColor {
        for (let i = 0; i < CATEGORY_ORDER.length; i++) {
            const category = CATEGORY_ORDER[i];
            const isLast = i === CATEGORY_ORDER.length - 1;
            const startIdx = indices[category];
            const endIdx = isLast ? Number.MAX_SAFE_INTEGER : indices[CATEGORY_ORDER[i + 1]];

            if (startIdx === undefined || endIdx === undefined) continue;

            if (index >= startIdx && index < endIdx) {
                return category;
            }
        }

        // "Should never happen" disclaimer goes here
        throw new Error("Programming error: somehow you've ended up with an index that isn't in a category");
    }

    // noinspection JSMethodCanBeStatic
    private moveRoomIndexes(
        nRooms: number,
        fromCategory: NotificationColor,
        toCategory: NotificationColor,
        indices: CategoryIndex,
    ): void {
        // We have to update the index of the category *after* the from/toCategory variables
        // in order to update the indices correctly. Because the room is moving from/to those
        // categories, the next category's index will change - not the category we're modifying.
        // We also need to update subsequent categories as they'll all shift by nRooms, so we
        // loop over the order to achieve that.

        this.alterCategoryPositionBy(fromCategory, -nRooms, indices);
        this.alterCategoryPositionBy(toCategory, +nRooms, indices);
    }

    private alterCategoryPositionBy(category: NotificationColor, n: number, indices: CategoryIndex): void {
        // Note: when we alter a category's index, we actually have to modify the ones following
        // the target and not the target itself.

        // XXX: If this ever actually gets more than one room passed to it, it'll need more index
        // handling. For instance, if 45 rooms are removed from the middle of a 50 room list, the
        // index for the categories will be way off.

        const nextOrderIndex = CATEGORY_ORDER.indexOf(category) + 1;

        if (n > 0) {
            for (let i = nextOrderIndex; i < CATEGORY_ORDER.length; i++) {
                const nextCategory = CATEGORY_ORDER[i];

                if (indices[nextCategory] === undefined) {
                    throw new Error(`Index of category ${category} not found`);
                }

                indices[nextCategory]! += Math.abs(n);
            }
        } else if (n < 0) {
            for (let i = nextOrderIndex; i < CATEGORY_ORDER.length; i++) {
                const nextCategory = CATEGORY_ORDER[i];

                if (indices[nextCategory] === undefined) {
                    throw new Error(`Index of category ${category} not found`);
                }

                indices[nextCategory]! -= Math.abs(n);
            }
        }

        // Do a quick check to see if we've completely broken the index
        for (let i = 1; i < CATEGORY_ORDER.length; i++) {
            const lastCat = CATEGORY_ORDER[i - 1];
            const lastCatIndex = indices[lastCat];
            const thisCat = CATEGORY_ORDER[i];
            const thisCatIndex = indices[thisCat];

            if (lastCatIndex === undefined || thisCatIndex === undefined || lastCatIndex > thisCatIndex) {
                // "should never happen" disclaimer goes here
                logger.warn(
                    `!! Room list index corruption: ${lastCat} (i:${indices[lastCat]}) is greater ` +
                        `than ${thisCat} (i:${indices[thisCat]}) - category indices are likely desynced from reality`,
                );

                // TODO: Regenerate index when this happens: https://github.com/vector-im/element-web/issues/14234
            }
        }
    }
}

/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import type { Room } from "matrix-js-sdk/src/models/room";
import type { EventEmitter } from "events";
import { ITagMap, ListAlgorithm, SortAlgorithm } from "./algorithms/models";
import { RoomUpdateCause, TagID } from "./models";
import { IFilterCondition } from "./filters/IFilterCondition";

export enum RoomListStoreEvent {
    // The event/channel which is called when the room lists have been changed.
    ListsUpdate = "lists_update",
    // The event which is called when the room list is loading.
    // Called with the (tagId, bool) which is true when the list is loading, else false.
    ListsLoading = "lists_loading",
}

export interface RoomListStore extends EventEmitter {
    /**
     * Gets an ordered set of rooms for the all known tags.
     * @returns {ITagMap} The cached list of rooms, ordered,
     * for each tag. May be empty, but never null/undefined.
     */
    get orderedLists(): ITagMap;

    /**
     * Return the total number of rooms in this list. Prefer this method to
     * RoomListStore.orderedLists[tagId].length because the client may not
     * be aware of all the rooms in this list (e.g in Sliding Sync).
     * @param tagId the tag to get the room count for.
     * @returns the number of rooms in this list, or 0 if the list is unknown.
     */
    getCount(tagId: TagID): number;

    /**
     * Set the sort algorithm for the specified tag.
     * @param tagId the tag to set the algorithm for
     * @param sort the sort algorithm to set to
     */
    setTagSorting(tagId: TagID, sort: SortAlgorithm): void;

    /**
     * Get the sort algorithm for the specified tag.
     * @param tagId tag to get the sort algorithm for
     * @returns the sort algorithm
     */
    getTagSorting(tagId: TagID): SortAlgorithm | null;

    /**
     * Set the list algorithm for the specified tag.
     * @param tagId the tag to set the algorithm for
     * @param order the list algorithm to set to
     */
    setListOrder(tagId: TagID, order: ListAlgorithm): void;

    /**
     * Get the list algorithm for the specified tag.
     * @param tagId tag to get the list algorithm for
     * @returns the list algorithm
     */
    getListOrder(tagId: TagID): ListAlgorithm | null;

    /**
     * Regenerates the room whole room list, discarding any previous results.
     *
     * Note: This is only exposed externally for the tests. Do not call this from within
     * the app.
     * @param params.trigger Set to false to prevent a list update from being sent. Should only
     * be used if the calling code will manually trigger the update.
     */
    regenerateAllLists(params: { trigger: boolean }): void;

    /**
     * Adds a filter condition to the room list store. Filters may be applied async,
     * and thus might not cause an update to the store immediately.
     * @param {IFilterCondition} filter The filter condition to add.
     */
    addFilter(filter: IFilterCondition): Promise<void>;

    /**
     * Removes a filter condition from the room list store. If the filter was
     * not previously added to the room list store, this will no-op. The effects
     * of removing a filter may be applied async and therefore might not cause
     * an update right away.
     * @param {IFilterCondition} filter The filter condition to remove.
     */
    removeFilter(filter: IFilterCondition): void;

    /**
     * Gets the tags for a room identified by the store. The returned set
     * should never be empty, and will contain DefaultTagID.Untagged if
     * the store is not aware of any tags.
     * @param room The room to get the tags for.
     * @returns The tags for the room.
     */
    getTagsForRoom(room: Room): TagID[];

    /**
     * Manually update a room with a given cause. This should only be used if the
     * room list store would otherwise be incapable of doing the update itself. Note
     * that this may race with the room list's regular operation.
     * @param {Room} room The room to update.
     * @param {RoomUpdateCause} cause The cause to update for.
     */
    manualRoomUpdate(room: Room, cause: RoomUpdateCause): Promise<void>;
}

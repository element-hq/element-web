/*
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
import { isNullOrUndefined } from "matrix-js-sdk/src/utils";
import DMRoomMap from "../../../utils/DMRoomMap";
import { EventEmitter } from "events";
import { arrayDiff, arrayHasDiff, ArrayUtil } from "../../../utils/arrays";
import { getEnumValues } from "../../../utils/enums";
import { DefaultTagID, RoomUpdateCause, TagID } from "../models";
import {
    IListOrderingMap,
    IOrderingAlgorithmMap,
    ITagMap,
    ITagSortingMap,
    ListAlgorithm,
    SortAlgorithm
} from "./models";
import { FILTER_CHANGED, FilterPriority, IFilterCondition } from "../filters/IFilterCondition";
import { EffectiveMembership, getEffectiveMembership, splitRoomsByMembership } from "../../../utils/membership";
import { OrderingAlgorithm } from "./list-ordering/OrderingAlgorithm";
import { getListAlgorithmInstance } from "./list-ordering";
import SettingsStore from "../../../settings/SettingsStore";

/**
 * Fired when the Algorithm has determined a list has been updated.
 */
export const LIST_UPDATED_EVENT = "list_updated_event";

// These are the causes which require a room to be known in order for us to handle them. If
// a cause in this list is raised and we don't know about the room, we don't handle the update.
//
// Note: these typically happen when a new room is coming in, such as the user creating or
// joining the room. For these cases, we need to know about the room prior to handling it otherwise
// we'll make bad assumptions.
const CAUSES_REQUIRING_ROOM = [
    RoomUpdateCause.Timeline,
    RoomUpdateCause.ReadReceipt,
];

interface IStickyRoom {
    room: Room;
    position: number;
    tag: TagID;
}

/**
 * Represents a list ordering algorithm. This class will take care of tag
 * management (which rooms go in which tags) and ask the implementation to
 * deal with ordering mechanics.
 */
export class Algorithm extends EventEmitter {
    private _cachedRooms: ITagMap = {};
    private _cachedStickyRooms: ITagMap = {}; // a clone of the _cachedRooms, with the sticky room
    private filteredRooms: ITagMap = {};
    private _stickyRoom: IStickyRoom = null;
    private _lastStickyRoom: IStickyRoom = null; // only not-null when changing the sticky room
    private sortAlgorithms: ITagSortingMap;
    private listAlgorithms: IListOrderingMap;
    private algorithms: IOrderingAlgorithmMap;
    private rooms: Room[] = [];
    private roomIdsToTags: {
        [roomId: string]: TagID[];
    } = {};
    private allowedByFilter: Map<IFilterCondition, Room[]> = new Map<IFilterCondition, Room[]>();
    private allowedRoomsByFilters: Set<Room> = new Set<Room>();

    public constructor() {
        super();
    }

    public get stickyRoom(): Room {
        return this._stickyRoom ? this._stickyRoom.room : null;
    }

    protected get hasFilters(): boolean {
        return this.allowedByFilter.size > 0;
    }

    protected set cachedRooms(val: ITagMap) {
        this._cachedRooms = val;
        this.recalculateFilteredRooms();
        this.recalculateStickyRoom();
    }

    protected get cachedRooms(): ITagMap {
        // 🐉 Here be dragons.
        // Note: this is used by the underlying algorithm classes, so don't make it return
        // the sticky room cache. If it ends up returning the sticky room cache, we end up
        // corrupting our caches and confusing them.
        return this._cachedRooms;
    }

    /**
     * Awaitable version of the sticky room setter.
     * @param val The new room to sticky.
     */
    public async setStickyRoom(val: Room) {
        await this.updateStickyRoom(val);
    }

    public getTagSorting(tagId: TagID): SortAlgorithm {
        if (!this.sortAlgorithms) return null;
        return this.sortAlgorithms[tagId];
    }

    public async setTagSorting(tagId: TagID, sort: SortAlgorithm) {
        if (!tagId) throw new Error("Tag ID must be defined");
        if (!sort) throw new Error("Algorithm must be defined");
        this.sortAlgorithms[tagId] = sort;

        const algorithm: OrderingAlgorithm = this.algorithms[tagId];
        await algorithm.setSortAlgorithm(sort);
        this._cachedRooms[tagId] = algorithm.orderedRooms;
        this.recalculateFilteredRoomsForTag(tagId); // update filter to re-sort the list
        this.recalculateStickyRoom(tagId); // update sticky room to make sure it appears if needed
    }

    public getListOrdering(tagId: TagID): ListAlgorithm {
        if (!this.listAlgorithms) return null;
        return this.listAlgorithms[tagId];
    }

    public async setListOrdering(tagId: TagID, order: ListAlgorithm) {
        if (!tagId) throw new Error("Tag ID must be defined");
        if (!order) throw new Error("Algorithm must be defined");
        this.listAlgorithms[tagId] = order;

        const algorithm = getListAlgorithmInstance(order, tagId, this.sortAlgorithms[tagId]);
        this.algorithms[tagId] = algorithm;

        await algorithm.setRooms(this._cachedRooms[tagId]);
        this._cachedRooms[tagId] = algorithm.orderedRooms;
        this.recalculateFilteredRoomsForTag(tagId); // update filter to re-sort the list
        this.recalculateStickyRoom(tagId); // update sticky room to make sure it appears if needed
    }

    public addFilterCondition(filterCondition: IFilterCondition): void {
        // Populate the cache of the new filter
        this.allowedByFilter.set(filterCondition, this.rooms.filter(r => filterCondition.isVisible(r)));
        this.recalculateFilteredRooms();
        filterCondition.on(FILTER_CHANGED, this.handleFilterChange.bind(this));
    }

    public removeFilterCondition(filterCondition: IFilterCondition): void {
        filterCondition.off(FILTER_CHANGED, this.handleFilterChange.bind(this));
        if (this.allowedByFilter.has(filterCondition)) {
            this.allowedByFilter.delete(filterCondition);
            this.recalculateFilteredRooms();

            // If we removed the last filter, tell consumers that we've "updated" our filtered
            // view. This will trick them into getting the complete room list.
            if (!this.hasFilters) {
                this.emit(LIST_UPDATED_EVENT);
            }
        }
    }

    private async handleFilterChange() {
        await this.recalculateFilteredRooms();

        // re-emit the update so the list store can fire an off-cycle update if needed
        this.emit(FILTER_CHANGED);
    }

    private async updateStickyRoom(val: Room) {
        try {
            return await this.doUpdateStickyRoom(val);
        } finally {
            this._lastStickyRoom = null; // clear to indicate we're done changing
        }
    }

    private async doUpdateStickyRoom(val: Room) {
        // Note throughout: We need async so we can wait for handleRoomUpdate() to do its thing,
        // otherwise we risk duplicating rooms.

        // Set the last sticky room to indicate that we're in a change. The code throughout the
        // class can safely handle a null room, so this should be safe to do as a backup.
        this._lastStickyRoom = this._stickyRoom || <IStickyRoom>{};

        // It's possible to have no selected room. In that case, clear the sticky room
        if (!val) {
            if (this._stickyRoom) {
                const stickyRoom = this._stickyRoom.room;
                this._stickyRoom = null; // clear before we go to update the algorithm

                // Lie to the algorithm and re-add the room to the algorithm
                await this.handleRoomUpdate(stickyRoom, RoomUpdateCause.NewRoom);
                return;
            }
            return;
        }

        // When we do have a room though, we expect to be able to find it
        let tag = this.roomIdsToTags[val.roomId][0];
        if (!tag) throw new Error(`${val.roomId} does not belong to a tag and cannot be sticky`);

        // We specifically do NOT use the ordered rooms set as it contains the sticky room, which
        // means we'll be off by 1 when the user is switching rooms. This leads to visual jumping
        // when the user is moving south in the list (not north, because of math).
        let position = this.getOrderedRoomsWithoutSticky()[tag].indexOf(val);
        if (position < 0) throw new Error(`${val.roomId} does not appear to be known and cannot be sticky`);

        // 🐉 Here be dragons.
        // Before we can go through with lying to the underlying algorithm about a room
        // we need to ensure that when we do we're ready for the inevitable sticky room
        // update we'll receive. To prepare for that, we first remove the sticky room and
        // recalculate the state ourselves so that when the underlying algorithm calls for
        // the same thing it no-ops. After we're done calling the algorithm, we'll issue
        // a new update for ourselves.
        const lastStickyRoom = this._stickyRoom;
        this._stickyRoom = null; // clear before we update the algorithm
        this.recalculateStickyRoom();

        // When we do have the room, re-add the old room (if needed) to the algorithm
        // and remove the sticky room from the algorithm. This is so the underlying
        // algorithm doesn't try and confuse itself with the sticky room concept.
        // We don't add the new room if the sticky room isn't changing because that's
        // an easy way to cause duplication. We have to do room ID checks instead of
        // referential checks as the references can differ through the lifecycle.
        if (lastStickyRoom && lastStickyRoom.room && lastStickyRoom.room.roomId !== val.roomId) {
            // Lie to the algorithm and re-add the room to the algorithm
            await this.handleRoomUpdate(lastStickyRoom.room, RoomUpdateCause.NewRoom);
        }
        // Lie to the algorithm and remove the room from it's field of view
        await this.handleRoomUpdate(val, RoomUpdateCause.RoomRemoved);

        // Check for tag & position changes while we're here. We also check the room to ensure
        // it is still the same room.
        if (this._stickyRoom) {
            if (this._stickyRoom.room !== val) {
                // Check the room IDs just in case
                if (this._stickyRoom.room.roomId === val.roomId) {
                    console.warn("Sticky room changed references");
                } else {
                    throw new Error("Sticky room changed while the sticky room was changing");
                }
            }

            console.warn(`Sticky room changed tag & position from ${tag} / ${position} `
                + `to ${this._stickyRoom.tag} / ${this._stickyRoom.position}`);

            tag = this._stickyRoom.tag;
            position = this._stickyRoom.position;
        }

        // Now that we're done lying to the algorithm, we need to update our position
        // marker only if the user is moving further down the same list. If they're switching
        // lists, or moving upwards, the position marker will splice in just fine but if
        // they went downwards in the same list we'll be off by 1 due to the shifting rooms.
        if (lastStickyRoom && lastStickyRoom.tag === tag && lastStickyRoom.position <= position) {
            position++;
        }

        this._stickyRoom = {
            room: val,
            position: position,
            tag: tag,
        };

        // We update the filtered rooms just in case, as otherwise users will end up visiting
        // a room while filtering and it'll disappear. We don't update the filter earlier in
        // this function simply because we don't have to.
        this.recalculateFilteredRoomsForTag(tag);
        if (lastStickyRoom && lastStickyRoom.tag !== tag) this.recalculateFilteredRoomsForTag(lastStickyRoom.tag);
        this.recalculateStickyRoom();

        // Finally, trigger an update
        this.emit(LIST_UPDATED_EVENT);
    }

    protected recalculateFilteredRooms() {
        if (!this.hasFilters) {
            return;
        }

        console.warn("Recalculating filtered room list");
        const filters = Array.from(this.allowedByFilter.keys());
        const orderedFilters = new ArrayUtil(filters)
            .groupBy(f => f.relativePriority)
            .orderBy(getEnumValues(FilterPriority))
            .value;
        const newMap: ITagMap = {};
        for (const tagId of Object.keys(this.cachedRooms)) {
            // Cheaply clone the rooms so we can more easily do operations on the list.
            // We optimize our lookups by trying to reduce sample size as much as possible
            // to the rooms we know will be deduped by the Set.
            const rooms = this.cachedRooms[tagId].map(r => r); // cheap clone
            this.tryInsertStickyRoomToFilterSet(rooms, tagId);
            let remainingRooms = rooms.map(r => r);
            let allowedRoomsInThisTag = [];
            let lastFilterPriority = orderedFilters[0].relativePriority;
            for (const filter of orderedFilters) {
                if (filter.relativePriority !== lastFilterPriority) {
                    // Every time the filter changes priority, we want more specific filtering.
                    // To accomplish that, reset the variables to make it look like the process
                    // has started over, but using the filtered rooms as the seed.
                    remainingRooms = allowedRoomsInThisTag;
                    allowedRoomsInThisTag = [];
                    lastFilterPriority = filter.relativePriority;
                }
                const filteredRooms = remainingRooms.filter(r => filter.isVisible(r));
                for (const room of filteredRooms) {
                    const idx = remainingRooms.indexOf(room);
                    if (idx >= 0) remainingRooms.splice(idx, 1);
                    allowedRoomsInThisTag.push(room);
                }
            }
            newMap[tagId] = allowedRoomsInThisTag;

            if (SettingsStore.getValue("advancedRoomListLogging")) {
                // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
                console.log(`[DEBUG] ${newMap[tagId].length}/${rooms.length} rooms filtered into ${tagId}`);
            }
        }

        const allowedRooms = Object.values(newMap).reduce((rv, v) => { rv.push(...v); return rv; }, <Room[]>[]);
        this.allowedRoomsByFilters = new Set(allowedRooms);
        this.filteredRooms = newMap;
        this.emit(LIST_UPDATED_EVENT);
    }

    protected recalculateFilteredRoomsForTag(tagId: TagID): void {
        if (!this.hasFilters) return; // don't bother doing work if there's nothing to do

        if (SettingsStore.getValue("advancedRoomListLogging")) {
            // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
            console.log(`Recalculating filtered rooms for ${tagId}`);
        }
        delete this.filteredRooms[tagId];
        const rooms = this.cachedRooms[tagId].map(r => r); // cheap clone
        this.tryInsertStickyRoomToFilterSet(rooms, tagId);
        const filteredRooms = rooms.filter(r => this.allowedRoomsByFilters.has(r));
        if (filteredRooms.length > 0) {
            this.filteredRooms[tagId] = filteredRooms;
        }

        if (SettingsStore.getValue("advancedRoomListLogging")) {
            // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
            console.log(`[DEBUG] ${filteredRooms.length}/${rooms.length} rooms filtered into ${tagId}`);
        }
    }

    protected tryInsertStickyRoomToFilterSet(rooms: Room[], tagId: TagID) {
        if (!this._stickyRoom || !this._stickyRoom.room || this._stickyRoom.tag !== tagId) return;

        const position = this._stickyRoom.position;
        if (position >= rooms.length) {
            rooms.push(this._stickyRoom.room);
        } else {
            rooms.splice(position, 0, this._stickyRoom.room);
        }
    }

    /**
     * Recalculate the sticky room position. If this is being called in relation to
     * a specific tag being updated, it should be given to this function to optimize
     * the call.
     * @param updatedTag The tag that was updated, if possible.
     */
    protected recalculateStickyRoom(updatedTag: TagID = null): void {
        // 🐉 Here be dragons.
        // This function does far too much for what it should, and is called by many places.
        // Not only is this responsible for ensuring the sticky room is held in place at all
        // times, it is also responsible for ensuring our clone of the cachedRooms is up to
        // date. If either of these desyncs, we see weird behaviour like duplicated rooms,
        // outdated lists, and other nonsensical issues that aren't necessarily obvious.

        if (!this._stickyRoom) {
            // If there's no sticky room, just do nothing useful.
            if (!!this._cachedStickyRooms) {
                // Clear the cache if we won't be needing it
                this._cachedStickyRooms = null;
                this.emit(LIST_UPDATED_EVENT);
            }
            return;
        }

        if (!this._cachedStickyRooms || !updatedTag) {
            if (SettingsStore.getValue("advancedRoomListLogging")) {
                // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
                console.log(`Generating clone of cached rooms for sticky room handling`);
            }
            const stickiedTagMap: ITagMap = {};
            for (const tagId of Object.keys(this.cachedRooms)) {
                stickiedTagMap[tagId] = this.cachedRooms[tagId].map(r => r); // shallow clone
            }
            this._cachedStickyRooms = stickiedTagMap;
        }

        if (updatedTag) {
            // Update the tag indicated by the caller, if possible. This is mostly to ensure
            // our cache is up to date.
            if (SettingsStore.getValue("advancedRoomListLogging")) {
                // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
                console.log(`Replacing cached sticky rooms for ${updatedTag}`);
            }
            this._cachedStickyRooms[updatedTag] = this.cachedRooms[updatedTag].map(r => r); // shallow clone
        }

        // Now try to insert the sticky room, if we need to.
        // We need to if there's no updated tag (we regenned the whole cache) or if the tag
        // we might have updated from the cache is also our sticky room.
        const sticky = this._stickyRoom;
        if (!updatedTag || updatedTag === sticky.tag) {
            if (SettingsStore.getValue("advancedRoomListLogging")) {
                // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
                console.log(`Inserting sticky room ${sticky.room.roomId} at position ${sticky.position} in ${sticky.tag}`);
            }
            this._cachedStickyRooms[sticky.tag].splice(sticky.position, 0, sticky.room);
        }

        // Finally, trigger an update
        this.emit(LIST_UPDATED_EVENT);
    }

    /**
     * Asks the Algorithm to regenerate all lists, using the tags given
     * as reference for which lists to generate and which way to generate
     * them.
     * @param {ITagSortingMap} tagSortingMap The tags to generate.
     * @param {IListOrderingMap} listOrderingMap The ordering of those tags.
     * @returns {Promise<*>} A promise which resolves when complete.
     */
    public async populateTags(tagSortingMap: ITagSortingMap, listOrderingMap: IListOrderingMap): Promise<any> {
        if (!tagSortingMap) throw new Error(`Sorting map cannot be null or empty`);
        if (!listOrderingMap) throw new Error(`Ordering ma cannot be null or empty`);
        if (arrayHasDiff(Object.keys(tagSortingMap), Object.keys(listOrderingMap))) {
            throw new Error(`Both maps must contain the exact same tags`);
        }
        this.sortAlgorithms = tagSortingMap;
        this.listAlgorithms = listOrderingMap;
        this.algorithms = {};
        for (const tag of Object.keys(tagSortingMap)) {
            this.algorithms[tag] = getListAlgorithmInstance(this.listAlgorithms[tag], tag, this.sortAlgorithms[tag]);
        }
        return this.setKnownRooms(this.rooms);
    }

    /**
     * Gets an ordered set of rooms for the all known tags, filtered.
     * @returns {ITagMap} The cached list of rooms, ordered,
     * for each tag. May be empty, but never null/undefined.
     */
    public getOrderedRooms(): ITagMap {
        if (!this.hasFilters) {
            return this._cachedStickyRooms || this.cachedRooms;
        }
        return this.filteredRooms;
    }

    /**
     * This returns the same as getOrderedRooms(), but without the sticky room
     * map as it causes issues for sticky room handling (see sticky room handling
     * for more information).
     * @returns {ITagMap} The cached list of rooms, ordered,
     * for each tag. May be empty, but never null/undefined.
     */
    private getOrderedRoomsWithoutSticky(): ITagMap {
        if (!this.hasFilters) {
            return this.cachedRooms;
        }
        return this.filteredRooms;
    }

    /**
     * Seeds the Algorithm with a set of rooms. The algorithm will discard all
     * previously known information and instead use these rooms instead.
     * @param {Room[]} rooms The rooms to force the algorithm to use.
     * @returns {Promise<*>} A promise which resolves when complete.
     */
    public async setKnownRooms(rooms: Room[]): Promise<any> {
        if (isNullOrUndefined(rooms)) throw new Error(`Array of rooms cannot be null`);
        if (!this.sortAlgorithms) throw new Error(`Cannot set known rooms without a tag sorting map`);

        console.warn("Resetting known rooms, initiating regeneration");

        // Before we go any further we need to clear (but remember) the sticky room to
        // avoid accidentally duplicating it in the list.
        const oldStickyRoom = this._stickyRoom;
        await this.updateStickyRoom(null);

        this.rooms = rooms;

        const newTags: ITagMap = {};
        for (const tagId in this.sortAlgorithms) {
            // noinspection JSUnfilteredForInLoop
            newTags[tagId] = [];
        }

        // If we can avoid doing work, do so.
        if (!rooms.length) {
            await this.generateFreshTags(newTags); // just in case it wants to do something
            this.cachedRooms = newTags;
            return;
        }

        // Split out the easy rooms first (leave and invite)
        const memberships = splitRoomsByMembership(rooms);
        for (const room of memberships[EffectiveMembership.Invite]) {
            newTags[DefaultTagID.Invite].push(room);
        }
        for (const room of memberships[EffectiveMembership.Leave]) {
            newTags[DefaultTagID.Archived].push(room);
        }

        // Now process all the joined rooms. This is a bit more complicated
        for (const room of memberships[EffectiveMembership.Join]) {
            const tags = this.getTagsOfJoinedRoom(room);

            let inTag = false;
            if (tags.length > 0) {
                for (const tag of tags) {
                    if (!isNullOrUndefined(newTags[tag])) {
                        newTags[tag].push(room);
                        inTag = true;
                    }
                }
            }

            if (!inTag) {
                if (DMRoomMap.shared().getUserIdForRoomId(room.roomId)) {
                    newTags[DefaultTagID.DM].push(room);
                } else {
                    newTags[DefaultTagID.Untagged].push(room);
                }
            }
        }

        await this.generateFreshTags(newTags);

        this.cachedRooms = newTags;
        this.updateTagsFromCache();
        this.recalculateFilteredRooms();

        // Now that we've finished generation, we need to update the sticky room to what
        // it was. It's entirely possible that it changed lists though, so if it did then
        // we also have to update the position of it.
        if (oldStickyRoom && oldStickyRoom.room) {
            await this.updateStickyRoom(oldStickyRoom.room);
            if (this._stickyRoom && this._stickyRoom.room) { // just in case the update doesn't go according to plan
                if (this._stickyRoom.tag !== oldStickyRoom.tag) {
                    // We put the sticky room at the top of the list to treat it as an obvious tag change.
                    this._stickyRoom.position = 0;
                    this.recalculateStickyRoom(this._stickyRoom.tag);
                }
            }
        }
    }

    public getTagsForRoom(room: Room): TagID[] {
        // XXX: This duplicates a lot of logic from setKnownRooms above, but has a slightly
        // different use case and therefore different performance curve

        const tags: TagID[] = [];

        const membership = getEffectiveMembership(room.getMyMembership());
        if (membership === EffectiveMembership.Invite) {
            tags.push(DefaultTagID.Invite);
        } else if (membership === EffectiveMembership.Leave) {
            tags.push(DefaultTagID.Archived);
        } else {
            tags.push(...this.getTagsOfJoinedRoom(room));
        }

        if (!tags.length) tags.push(DefaultTagID.Untagged);

        return tags;
    }

    private getTagsOfJoinedRoom(room: Room): TagID[] {
        let tags = Object.keys(room.tags || {});

        if (tags.length === 0) {
            // Check to see if it's a DM if it isn't anything else
            if (DMRoomMap.shared().getUserIdForRoomId(room.roomId)) {
                tags = [DefaultTagID.DM];
            }
        }

        return tags;
    }

    /**
     * Updates the roomsToTags map
     */
    private updateTagsFromCache() {
        const newMap = {};

        const tags = Object.keys(this.cachedRooms);
        for (const tagId of tags) {
            const rooms = this.cachedRooms[tagId];
            for (const room of rooms) {
                if (!newMap[room.roomId]) newMap[room.roomId] = [];
                newMap[room.roomId].push(tagId);
            }
        }

        this.roomIdsToTags = newMap;
    }

    /**
     * Called when the Algorithm believes a complete regeneration of the existing
     * lists is needed.
     * @param {ITagMap} updatedTagMap The tag map which needs populating. Each tag
     * will already have the rooms which belong to it - they just need ordering. Must
     * be mutated in place.
     * @returns {Promise<*>} A promise which resolves when complete.
     */
    private async generateFreshTags(updatedTagMap: ITagMap): Promise<any> {
        if (!this.algorithms) throw new Error("Not ready: no algorithms to determine tags from");

        for (const tag of Object.keys(updatedTagMap)) {
            const algorithm: OrderingAlgorithm = this.algorithms[tag];
            if (!algorithm) throw new Error(`No algorithm for ${tag}`);

            await algorithm.setRooms(updatedTagMap[tag]);
            updatedTagMap[tag] = algorithm.orderedRooms;
        }
    }

    /**
     * Asks the Algorithm to update its knowledge of a room. For example, when
     * a user tags a room, joins/creates a room, or leaves a room the Algorithm
     * should be told that the room's info might have changed. The Algorithm
     * may no-op this request if no changes are required.
     * @param {Room} room The room which might have affected sorting.
     * @param {RoomUpdateCause} cause The reason for the update being triggered.
     * @returns {Promise<boolean>} A promise which resolve to true or false
     * depending on whether or not getOrderedRooms() should be called after
     * processing.
     */
    public async handleRoomUpdate(room: Room, cause: RoomUpdateCause): Promise<boolean> {
        if (SettingsStore.getValue("advancedRoomListLogging")) {
            // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
            console.log(`Handle room update for ${room.roomId} called with cause ${cause}`);
        }
        if (!this.algorithms) throw new Error("Not ready: no algorithms to determine tags from");

        // Note: check the isSticky against the room ID just in case the reference is wrong
        const isSticky = this._stickyRoom && this._stickyRoom.room && this._stickyRoom.room.roomId === room.roomId;
        if (cause === RoomUpdateCause.NewRoom) {
            const isForLastSticky = this._lastStickyRoom && this._lastStickyRoom.room === room;
            const roomTags = this.roomIdsToTags[room.roomId];
            const hasTags = roomTags && roomTags.length > 0;

            // Don't change the cause if the last sticky room is being re-added. If we fail to
            // pass the cause through as NewRoom, we'll fail to lie to the algorithm and thus
            // lose the room.
            if (hasTags && !isForLastSticky) {
                console.warn(`${room.roomId} is reportedly new but is already known - assuming TagChange instead`);
                cause = RoomUpdateCause.PossibleTagChange;
            }

            // Check to see if the room is known first
            let knownRoomRef = this.rooms.includes(room);
            if (hasTags && !knownRoomRef) {
                console.warn(`${room.roomId} might be a reference change - attempting to update reference`);
                this.rooms = this.rooms.map(r => r.roomId === room.roomId ? room : r);
                knownRoomRef = this.rooms.includes(room);
                if (!knownRoomRef) {
                    console.warn(`${room.roomId} is still not referenced. It may be sticky.`);
                }
            }

            // If we have tags for a room and don't have the room referenced, something went horribly
            // wrong - the reference should have been updated above.
            if (hasTags && !knownRoomRef && !isSticky) {
                throw new Error(`${room.roomId} is missing from room array but is known - trying to find duplicate`);
            }

            // Like above, update the reference to the sticky room if we need to
            if (hasTags && isSticky) {
                // Go directly in and set the sticky room's new reference, being careful not
                // to trigger a sticky room update ourselves.
                this._stickyRoom.room = room;
            }

            // If after all that we're still a NewRoom update, add the room if applicable.
            // We don't do this for the sticky room (because it causes duplication issues)
            // or if we know about the reference (as it should be replaced).
            if (cause === RoomUpdateCause.NewRoom && !isSticky && !knownRoomRef) {
                this.rooms.push(room);
            }
        }

        let didTagChange = false;
        if (cause === RoomUpdateCause.PossibleTagChange) {
            const oldTags = this.roomIdsToTags[room.roomId] || [];
            const newTags = this.getTagsForRoom(room);
            const diff = arrayDiff(oldTags, newTags);
            if (diff.removed.length > 0 || diff.added.length > 0) {
                for (const rmTag of diff.removed) {
                    if (SettingsStore.getValue("advancedRoomListLogging")) {
                        // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
                        console.log(`Removing ${room.roomId} from ${rmTag}`);
                    }
                    const algorithm: OrderingAlgorithm = this.algorithms[rmTag];
                    if (!algorithm) throw new Error(`No algorithm for ${rmTag}`);
                    await algorithm.handleRoomUpdate(room, RoomUpdateCause.RoomRemoved);
                    this.cachedRooms[rmTag] = algorithm.orderedRooms;
                }
                for (const addTag of diff.added) {
                    if (SettingsStore.getValue("advancedRoomListLogging")) {
                        // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
                        console.log(`Adding ${room.roomId} to ${addTag}`);
                    }
                    const algorithm: OrderingAlgorithm = this.algorithms[addTag];
                    if (!algorithm) throw new Error(`No algorithm for ${addTag}`);
                    await algorithm.handleRoomUpdate(room, RoomUpdateCause.NewRoom);
                    this.cachedRooms[addTag] = algorithm.orderedRooms;
                }

                // Update the tag map so we don't regen it in a moment
                this.roomIdsToTags[room.roomId] = newTags;

                if (SettingsStore.getValue("advancedRoomListLogging")) {
                    // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
                    console.log(`Changing update cause for ${room.roomId} to Timeline to sort rooms`);
                }
                cause = RoomUpdateCause.Timeline;
                didTagChange = true;
            } else {
                if (SettingsStore.getValue("advancedRoomListLogging")) {
                    // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
                    console.log(`Received no-op update for ${room.roomId} - changing to Timeline update`);
                }
                cause = RoomUpdateCause.Timeline;
            }

            if (didTagChange && isSticky) {
                // Manually update the tag for the sticky room without triggering a sticky room
                // update. The update will be handled implicitly by the sticky room handling and
                // requires no changes on our part, if we're in the middle of a sticky room change.
                if (this._lastStickyRoom) {
                    this._stickyRoom = {
                        room,
                        tag: this.roomIdsToTags[room.roomId][0],
                        position: 0, // right at the top as it changed tags
                    };
                } else {
                    // We have to clear the lock as the sticky room change will trigger updates.
                    await this.setStickyRoom(room);
                }
            }
        }

        // If the update is for a room change which might be the sticky room, prevent it. We
        // need to make sure that the causes (NewRoom and RoomRemoved) are still triggered though
        // as the sticky room relies on this.
        if (cause !== RoomUpdateCause.NewRoom && cause !== RoomUpdateCause.RoomRemoved) {
            if (this.stickyRoom === room) {
                if (SettingsStore.getValue("advancedRoomListLogging")) {
                    // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
                    console.warn(`[RoomListDebug] Received ${cause} update for sticky room ${room.roomId} - ignoring`);
                }
                return false;
            }
        }

        if (!this.roomIdsToTags[room.roomId]) {
            if (CAUSES_REQUIRING_ROOM.includes(cause)) {
                if (SettingsStore.getValue("advancedRoomListLogging")) {
                    // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
                    console.warn(`Skipping tag update for ${room.roomId} because we don't know about the room`);
                }
                return false;
            }

            if (SettingsStore.getValue("advancedRoomListLogging")) {
                // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
                console.log(`[RoomListDebug] Updating tags for room ${room.roomId} (${room.name})`);
            }

            // Get the tags for the room and populate the cache
            const roomTags = this.getTagsForRoom(room).filter(t => !isNullOrUndefined(this.cachedRooms[t]));

            // "This should never happen" condition - we specify DefaultTagID.Untagged in getTagsForRoom(),
            // which means we should *always* have a tag to go off of.
            if (!roomTags.length) throw new Error(`Tags cannot be determined for ${room.roomId}`);

            this.roomIdsToTags[room.roomId] = roomTags;

            if (SettingsStore.getValue("advancedRoomListLogging")) {
                // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
                console.log(`[RoomListDebug] Updated tags for ${room.roomId}:`, roomTags);
            }
        }

        if (SettingsStore.getValue("advancedRoomListLogging")) {
            // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
            console.log(`[RoomListDebug] Reached algorithmic handling for ${room.roomId} and cause ${cause}`);
        }

        const tags = this.roomIdsToTags[room.roomId];
        if (!tags) {
            console.warn(`No tags known for "${room.name}" (${room.roomId})`);
            return false;
        }

        let changed = didTagChange;
        for (const tag of tags) {
            const algorithm: OrderingAlgorithm = this.algorithms[tag];
            if (!algorithm) throw new Error(`No algorithm for ${tag}`);

            await algorithm.handleRoomUpdate(room, cause);
            this.cachedRooms[tag] = algorithm.orderedRooms;

            // Flag that we've done something
            this.recalculateFilteredRoomsForTag(tag); // update filter to re-sort the list
            this.recalculateStickyRoom(tag); // update sticky room to make sure it appears if needed
            changed = true;
        }

        if (SettingsStore.getValue("advancedRoomListLogging")) {
            // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14602
            console.log(`[RoomListDebug] Finished handling ${room.roomId} with cause ${cause} (changed=${changed})`);
        }
        return changed;
    }
}

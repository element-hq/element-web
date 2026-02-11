/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { JoinRule, type Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { isNullOrUndefined } from "matrix-js-sdk/src/utils";
import { EventEmitter } from "events";
import { logger } from "matrix-js-sdk/src/logger";

import DMRoomMap from "../../../utils/DMRoomMap";
import { arrayDiff, arrayHasDiff } from "../../../utils/arrays";
import { DefaultTagID, RoomUpdateCause, type TagID } from "../models";
import {
    type IListOrderingMap,
    type IOrderingAlgorithmMap,
    type ITagMap,
    type ITagSortingMap,
    type ListAlgorithm,
    type SortAlgorithm,
} from "./models";
import {
    EffectiveMembership,
    getEffectiveMembership,
    getEffectiveMembershipTag,
    splitRoomsByMembership,
} from "../../../utils/membership";
import { type OrderingAlgorithm } from "./list-ordering/OrderingAlgorithm";
import { getListAlgorithmInstance } from "./list-ordering";
import { VisibilityProvider } from "../filters/VisibilityProvider";
import { CallStore, CallStoreEvent } from "../../CallStore";

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
const CAUSES_REQUIRING_ROOM = [RoomUpdateCause.Timeline, RoomUpdateCause.ReadReceipt];

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
    private _cachedStickyRooms: ITagMap | null = {}; // a clone of the _cachedRooms, with the sticky room
    private _stickyRoom: IStickyRoom | null = null;
    private _lastStickyRoom: IStickyRoom | null = null; // only not-null when changing the sticky room
    private sortAlgorithms: ITagSortingMap | null = null;
    private listAlgorithms: IListOrderingMap | null = null;
    private algorithms: IOrderingAlgorithmMap | null = null;
    private rooms: Room[] = [];
    private roomIdsToTags: {
        [roomId: string]: TagID[];
    } = {};

    /**
     * Set to true to suspend emissions of algorithm updates.
     */
    public updatesInhibited = false;

    public start(): void {
        CallStore.instance.on(CallStoreEvent.ConnectedCalls, this.onConnectedCalls);
    }

    public stop(): void {
        CallStore.instance.off(CallStoreEvent.ConnectedCalls, this.onConnectedCalls);
    }

    public get stickyRoom(): Room | null {
        return this._stickyRoom ? this._stickyRoom.room : null;
    }

    public get hasTagSortingMap(): boolean {
        return !!this.sortAlgorithms;
    }

    protected set cachedRooms(val: ITagMap) {
        this._cachedRooms = val;
        this.recalculateStickyRoom();
        this.recalculateActiveCallRooms();
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
    public setStickyRoom(val: Room | null): void {
        try {
            this.updateStickyRoom(val);
        } catch (e) {
            logger.warn("Failed to update sticky room", e);
        }
    }

    public getTagSorting(tagId: TagID): SortAlgorithm | null {
        if (!this.sortAlgorithms) return null;
        return this.sortAlgorithms[tagId];
    }

    public setTagSorting(tagId: TagID, sort: SortAlgorithm): void {
        if (!tagId) throw new Error("Tag ID must be defined");
        if (!sort) throw new Error("Algorithm must be defined");
        if (!this.sortAlgorithms) throw new Error("this.sortAlgorithms must be defined before calling setTagSorting");
        if (!this.algorithms) throw new Error("this.algorithms must be defined before calling setTagSorting");
        this.sortAlgorithms[tagId] = sort;

        const algorithm: OrderingAlgorithm = this.algorithms[tagId];
        algorithm.setSortAlgorithm(sort);
        this._cachedRooms[tagId] = algorithm.orderedRooms;
        this.recalculateStickyRoom(tagId); // update sticky room to make sure it appears if needed
        this.recalculateActiveCallRooms(tagId);
    }

    public getListOrdering(tagId: TagID): ListAlgorithm | null {
        if (!this.listAlgorithms) return null;
        return this.listAlgorithms[tagId];
    }

    public setListOrdering(tagId: TagID, order: ListAlgorithm): void {
        if (!tagId) throw new Error("Tag ID must be defined");
        if (!order) throw new Error("Algorithm must be defined");
        if (!this.sortAlgorithms) throw new Error("this.sortAlgorithms must be defined before calling setListOrdering");
        if (!this.listAlgorithms) throw new Error("this.listAlgorithms must be defined before calling setListOrdering");
        if (!this.algorithms) throw new Error("this.algorithms must be defined before calling setListOrdering");
        this.listAlgorithms[tagId] = order;

        const algorithm = getListAlgorithmInstance(order, tagId, this.sortAlgorithms[tagId]);
        this.algorithms[tagId] = algorithm;

        algorithm.setRooms(this._cachedRooms[tagId]);
        this._cachedRooms[tagId] = algorithm.orderedRooms;
        this.recalculateStickyRoom(tagId); // update sticky room to make sure it appears if needed
        this.recalculateActiveCallRooms(tagId);
    }

    private updateStickyRoom(val: Room | null): void {
        this.doUpdateStickyRoom(val);
        this._lastStickyRoom = null; // clear to indicate we're done changing
    }

    private doUpdateStickyRoom(val: Room | null): void {
        if (val?.isSpaceRoom() && val.getMyMembership() !== KnownMembership.Invite) {
            // no-op sticky rooms for spaces - they're effectively virtual rooms
            val = null;
        }

        if (val && !VisibilityProvider.instance.isRoomVisible(val)) {
            val = null; // the room isn't visible - lie to the rest of this function
        }

        // Set the last sticky room to indicate that we're in a change. The code throughout the
        // class can safely handle a null room, so this should be safe to do as a backup.
        this._lastStickyRoom = this._stickyRoom || <IStickyRoom>{};

        // It's possible to have no selected room. In that case, clear the sticky room
        if (!val) {
            if (this._stickyRoom) {
                const stickyRoom = this._stickyRoom.room;
                this._stickyRoom = null; // clear before we go to update the algorithm

                // Lie to the algorithm and re-add the room to the algorithm
                this.handleRoomUpdate(stickyRoom, RoomUpdateCause.NewRoom);
                return;
            }
            return;
        }

        // When we do have a room though, we expect to be able to find it
        let tag = this.roomIdsToTags[val.roomId]?.[0];
        if (!tag) throw new Error(`${val.roomId} does not belong to a tag and cannot be sticky`);

        // We specifically do NOT use the ordered rooms set as it contains the sticky room, which
        // means we'll be off by 1 when the user is switching rooms. This leads to visual jumping
        // when the user is moving south in the list (not north, because of math).
        const tagList = this.getOrderedRoomsWithoutSticky()[tag] || []; // can be null if filtering
        let position = tagList.indexOf(val);

        // We do want to see if a tag change happened though - if this did happen then we'll want
        // to force the position to zero (top) to ensure we can properly handle it.
        const wasSticky = this._lastStickyRoom.room ? this._lastStickyRoom.room.roomId === val.roomId : false;
        if (this._lastStickyRoom.tag && tag !== this._lastStickyRoom.tag && wasSticky && position < 0) {
            logger.warn(`Sticky room ${val.roomId} changed tags during sticky room handling`);
            position = 0;
        }

        // Sanity check the position to make sure the room is qualified for being sticky
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
            this.handleRoomUpdate(lastStickyRoom.room, RoomUpdateCause.NewRoom);
        }
        // Lie to the algorithm and remove the room from it's field of view
        this.handleRoomUpdate(val, RoomUpdateCause.RoomRemoved);

        // handleRoomUpdate may have modified this._stickyRoom. Convince the
        // compiler of this fact.
        this._stickyRoom = this.stickyRoomMightBeModified();

        // Check for tag & position changes while we're here. We also check the room to ensure
        // it is still the same room.
        if (this._stickyRoom) {
            if (this._stickyRoom.room !== val) {
                // Check the room IDs just in case
                if (this._stickyRoom.room.roomId === val.roomId) {
                    logger.warn("Sticky room changed references");
                } else {
                    throw new Error("Sticky room changed while the sticky room was changing");
                }
            }

            logger.warn(
                `Sticky room changed tag & position from ${tag} / ${position} ` +
                    `to ${this._stickyRoom.tag} / ${this._stickyRoom.position}`,
            );

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
        this.recalculateStickyRoom();
        this.recalculateActiveCallRooms(tag);
        if (lastStickyRoom && lastStickyRoom.tag !== tag) this.recalculateActiveCallRooms(lastStickyRoom.tag);

        // Finally, trigger an update
        if (this.updatesInhibited) return;
        this.emit(LIST_UPDATED_EVENT);
    }

    /**
     * Hack to prevent Typescript claiming this._stickyRoom is always null.
     */
    private stickyRoomMightBeModified(): IStickyRoom | null {
        return this._stickyRoom;
    }

    private onConnectedCalls = (): void => {
        // In case we're unsticking a room, sort it back into natural order
        this.recalculateStickyRoom();

        // Update the stickiness of rooms with calls
        this.recalculateActiveCallRooms();

        if (this.updatesInhibited) return;
        // This isn't in response to any particular RoomListStore update,
        // so notify the store that it needs to force-update
        this.emit(LIST_UPDATED_EVENT, true);
    };

    private initCachedStickyRooms(): void {
        this._cachedStickyRooms = {};
        for (const tagId of Object.keys(this.cachedRooms)) {
            this._cachedStickyRooms[tagId] = [...this.cachedRooms[tagId]]; // shallow clone
        }
    }

    /**
     * Recalculate the sticky room position. If this is being called in relation to
     * a specific tag being updated, it should be given to this function to optimize
     * the call.
     * @param updatedTag The tag that was updated, if possible.
     */
    protected recalculateStickyRoom(updatedTag: TagID | null = null): void {
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
                if (this.updatesInhibited) return;
                this.emit(LIST_UPDATED_EVENT);
            }
            return;
        }

        if (!this._cachedStickyRooms || !updatedTag) {
            this.initCachedStickyRooms();
        }

        if (updatedTag) {
            // Update the tag indicated by the caller, if possible. This is mostly to ensure
            // our cache is up to date.
            if (this._cachedStickyRooms) {
                this._cachedStickyRooms[updatedTag] = [...this.cachedRooms[updatedTag]]; // shallow clone
            }
        }

        // Now try to insert the sticky room, if we need to.
        // We need to if there's no updated tag (we regenned the whole cache) or if the tag
        // we might have updated from the cache is also our sticky room.
        const sticky = this._stickyRoom;
        if (sticky && (!updatedTag || updatedTag === sticky.tag) && this._cachedStickyRooms) {
            this._cachedStickyRooms[sticky.tag].splice(sticky.position, 0, sticky.room);
        }

        // Finally, trigger an update
        if (this.updatesInhibited) return;
        this.emit(LIST_UPDATED_EVENT);
    }

    /**
     * Recalculate the position of any rooms with calls. If this is being called in
     * relation to a specific tag being updated, it should be given to this function to
     * optimize the call.
     *
     * This expects to be called *after* the sticky rooms are updated, and sticks the
     * room with the currently active call to the top of its tag.
     *
     * @param updatedTag The tag that was updated, if possible.
     */
    protected recalculateActiveCallRooms(updatedTag: TagID | null = null): void {
        if (!updatedTag) {
            // Assume all tags need updating
            // We're not modifying the map here, so can safely rely on the cached values
            // rather than the explicitly sticky map.
            for (const tagId of Object.keys(this.cachedRooms)) {
                if (!tagId) {
                    throw new Error("Unexpected recursion: falsy tag");
                }
                this.recalculateActiveCallRooms(tagId);
            }
            return;
        }

        if (CallStore.instance.connectedCalls.size) {
            // We operate on the sticky rooms map
            if (!this._cachedStickyRooms) this.initCachedStickyRooms();
            const rooms = this._cachedStickyRooms![updatedTag];

            const activeRoomIds = new Set([...CallStore.instance.connectedCalls].map((call) => call.roomId));
            const activeRooms: Room[] = [];
            const inactiveRooms: Room[] = [];

            for (const room of rooms) {
                (activeRoomIds.has(room.roomId) ? activeRooms : inactiveRooms).push(room);
            }

            // Stick rooms with active calls to the top
            this._cachedStickyRooms![updatedTag] = [...activeRooms, ...inactiveRooms];
        }
    }

    /**
     * Asks the Algorithm to regenerate all lists, using the tags given
     * as reference for which lists to generate and which way to generate
     * them.
     * @param {ITagSortingMap} tagSortingMap The tags to generate.
     * @param {IListOrderingMap} listOrderingMap The ordering of those tags.
     */
    public populateTags(tagSortingMap: ITagSortingMap, listOrderingMap: IListOrderingMap): void {
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
     * Gets an ordered set of rooms for the all known tags.
     * @returns {ITagMap} The cached list of rooms, ordered,
     * for each tag. May be empty, but never null/undefined.
     */
    public getOrderedRooms(): ITagMap {
        return this._cachedStickyRooms || this.cachedRooms;
    }

    /**
     * This returns the same as getOrderedRooms(), but without the sticky room
     * map as it causes issues for sticky room handling (see sticky room handling
     * for more information).
     * @returns {ITagMap} The cached list of rooms, ordered,
     * for each tag. May be empty, but never null/undefined.
     */
    private getOrderedRoomsWithoutSticky(): ITagMap {
        return this.cachedRooms;
    }

    /**
     * Seeds the Algorithm with a set of rooms. The algorithm will discard all
     * previously known information and instead use these rooms instead.
     * @param {Room[]} rooms The rooms to force the algorithm to use.
     */
    public setKnownRooms(rooms: Room[]): void {
        if (isNullOrUndefined(rooms)) throw new Error(`Array of rooms cannot be null`);
        if (!this.sortAlgorithms) throw new Error(`Cannot set known rooms without a tag sorting map`);

        if (!this.updatesInhibited) {
            // We only log this if we're expecting to be publishing updates, which means that
            // this could be an unexpected invocation. If we're inhibited, then this is probably
            // an intentional invocation.
            logger.warn("Resetting known rooms, initiating regeneration");
        }

        // Before we go any further we need to clear (but remember) the sticky room to
        // avoid accidentally duplicating it in the list.
        const oldStickyRoom = this._stickyRoom;
        if (oldStickyRoom) this.updateStickyRoom(null);

        this.rooms = rooms;

        const newTags: ITagMap = {};
        for (const tagId in this.sortAlgorithms) {
            // noinspection JSUnfilteredForInLoop
            newTags[tagId] = [];
        }

        // If we can avoid doing work, do so.
        if (!rooms.length) {
            this.generateFreshTags(newTags); // just in case it wants to do something
            this.cachedRooms = newTags;
            return;
        }

        // Split out the easy rooms first (leave and invite)
        const memberships = splitRoomsByMembership(rooms);

        for (const room of memberships[EffectiveMembership.Invite]) {
            newTags[DefaultTagID.Invite].push(room);
        }
        for (const room of memberships[EffectiveMembership.Leave]) {
            // We may not have had an archived section previously, so make sure its there.
            if (newTags[DefaultTagID.Archived] === undefined) newTags[DefaultTagID.Archived] = [];
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

        this.generateFreshTags(newTags);

        this.cachedRooms = newTags; // this recalculates the filtered rooms for us
        this.updateTagsFromCache();

        // Now that we've finished generation, we need to update the sticky room to what
        // it was. It's entirely possible that it changed lists though, so if it did then
        // we also have to update the position of it.
        if (oldStickyRoom && oldStickyRoom.room) {
            this.updateStickyRoom(oldStickyRoom.room);
            if (this._stickyRoom && this._stickyRoom.room) {
                // just in case the update doesn't go according to plan
                if (this._stickyRoom.tag !== oldStickyRoom.tag) {
                    // We put the sticky room at the top of the list to treat it as an obvious tag change.
                    this._stickyRoom.position = 0;
                    this.recalculateStickyRoom(this._stickyRoom.tag);
                }
            }
        }
    }

    public getTagsForRoom(room: Room): TagID[] {
        const tags: TagID[] = [];

        if (!getEffectiveMembership(room.getMyMembership())) return []; // peeked room has no tags

        const membership = getEffectiveMembershipTag(room);

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
        if (room.isCallRoom() && (room.getJoinRule() === JoinRule.Public || room.getJoinRule() === JoinRule.Knock)) {
            tags.push(DefaultTagID.Conference);
        }

        return tags;
    }

    /**
     * Updates the roomsToTags map
     */
    private updateTagsFromCache(): void {
        const newMap: Algorithm["roomIdsToTags"] = {};

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
     */
    private generateFreshTags(updatedTagMap: ITagMap): void {
        if (!this.algorithms) throw new Error("Not ready: no algorithms to determine tags from");

        for (const tag of Object.keys(updatedTagMap)) {
            const algorithm: OrderingAlgorithm = this.algorithms[tag];
            if (!algorithm) throw new Error(`No algorithm for ${tag}`);

            algorithm.setRooms(updatedTagMap[tag]);
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
     * @returns {Promise<boolean>} A boolean of whether or not getOrderedRooms()
     * should be called after processing.
     */
    public handleRoomUpdate(room: Room, cause: RoomUpdateCause): boolean {
        if (!this.algorithms) throw new Error("Not ready: no algorithms to determine tags from");

        // Note: check the isSticky against the room ID just in case the reference is wrong
        const isSticky = this._stickyRoom?.room?.roomId === room.roomId;
        if (cause === RoomUpdateCause.NewRoom) {
            const isForLastSticky = this._lastStickyRoom?.room === room;
            const roomTags = this.roomIdsToTags[room.roomId];
            const hasTags = roomTags && roomTags.length > 0;

            // Don't change the cause if the last sticky room is being re-added. If we fail to
            // pass the cause through as NewRoom, we'll fail to lie to the algorithm and thus
            // lose the room.
            if (hasTags && !isForLastSticky) {
                logger.warn(`${room.roomId} is reportedly new but is already known - assuming TagChange instead`);
                cause = RoomUpdateCause.PossibleTagChange;
            }

            // Check to see if the room is known first
            let knownRoomRef = this.rooms.includes(room);
            if (hasTags && !knownRoomRef) {
                logger.warn(`${room.roomId} might be a reference change - attempting to update reference`);
                this.rooms = this.rooms.map((r) => (r.roomId === room.roomId ? room : r));
                knownRoomRef = this.rooms.includes(room);
                if (!knownRoomRef) {
                    logger.warn(`${room.roomId} is still not referenced. It may be sticky.`);
                }
            }

            // If we have tags for a room and don't have the room referenced, something went horribly
            // wrong - the reference should have been updated above.
            if (hasTags && !knownRoomRef && !isSticky) {
                throw new Error(`${room.roomId} is missing from room array but is known - trying to find duplicate`);
            }

            // Like above, update the reference to the sticky room if we need to
            if (hasTags && isSticky && this._stickyRoom) {
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
                    const algorithm: OrderingAlgorithm = this.algorithms[rmTag];
                    if (!algorithm) throw new Error(`No algorithm for ${rmTag}`);
                    algorithm.handleRoomUpdate(room, RoomUpdateCause.RoomRemoved);
                    this._cachedRooms[rmTag] = algorithm.orderedRooms;
                    this.recalculateStickyRoom(rmTag); // update sticky room to make sure it moves if needed
                    this.recalculateActiveCallRooms(rmTag);
                }
                for (const addTag of diff.added) {
                    const algorithm: OrderingAlgorithm = this.algorithms[addTag];
                    if (!algorithm) throw new Error(`No algorithm for ${addTag}`);
                    algorithm.handleRoomUpdate(room, RoomUpdateCause.NewRoom);
                    this._cachedRooms[addTag] = algorithm.orderedRooms;
                }

                // Update the tag map so we don't regen it in a moment
                this.roomIdsToTags[room.roomId] = newTags;

                cause = RoomUpdateCause.Timeline;
                didTagChange = true;
            } else {
                // This is a tag change update and no tags were changed, nothing to do!
                return false;
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
                    this.setStickyRoom(room);
                }
            }
        }

        // If the update is for a room change which might be the sticky room, prevent it. We
        // need to make sure that the causes (NewRoom and RoomRemoved) are still triggered though
        // as the sticky room relies on this.
        if (cause !== RoomUpdateCause.NewRoom && cause !== RoomUpdateCause.RoomRemoved) {
            if (this.stickyRoom === room) {
                return false;
            }
        }

        if (!this.roomIdsToTags[room.roomId]) {
            if (CAUSES_REQUIRING_ROOM.includes(cause)) {
                return false;
            }

            // Get the tags for the room and populate the cache
            const roomTags = this.getTagsForRoom(room).filter((t) => !isNullOrUndefined(this.cachedRooms[t]));

            // "This should never happen" condition - we specify DefaultTagID.Untagged in getTagsForRoom(),
            // which means we should *always* have a tag to go off of.
            if (!roomTags.length) throw new Error(`Tags cannot be determined for ${room.roomId}`);

            this.roomIdsToTags[room.roomId] = roomTags;
        }

        const tags = this.roomIdsToTags[room.roomId];
        if (!tags) {
            logger.warn(`No tags known for "${room.name}" (${room.roomId})`);
            return false;
        }

        let changed = didTagChange;
        for (const tag of tags) {
            const algorithm: OrderingAlgorithm = this.algorithms[tag];
            if (!algorithm) throw new Error(`No algorithm for ${tag}`);

            algorithm.handleRoomUpdate(room, cause);
            this._cachedRooms[tag] = algorithm.orderedRooms;

            // Flag that we've done something
            this.recalculateStickyRoom(tag); // update sticky room to make sure it appears if needed
            this.recalculateActiveCallRooms(tag);
            changed = true;
        }

        return changed;
    }
}

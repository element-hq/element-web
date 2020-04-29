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

import { DefaultTagID, TagID } from "../models";
import { Room } from "matrix-js-sdk/src/models/room";
import { isNullOrUndefined } from "matrix-js-sdk/src/utils";
import { EffectiveMembership, splitRoomsByMembership } from "../membership";

export enum SortAlgorithm {
    Manual = "MANUAL",
    Alphabetic = "ALPHABETIC",
    Recent = "RECENT",
}

export enum ListAlgorithm {
    // Orders Red > Grey > Bold > Idle
    Importance = "IMPORTANCE",

    // Orders however the SortAlgorithm decides
    Natural = "NATURAL",
}

export interface ITagSortingMap {
    // @ts-ignore - TypeScript really wants this to be [tagId: string] but we know better.
    [tagId: TagID]: SortAlgorithm;
}

export interface ITagMap {
    // @ts-ignore - TypeScript really wants this to be [tagId: string] but we know better.
    [tagId: TagID]: Room[];
}

// TODO: Add locking support to avoid concurrent writes?
// TODO: EventEmitter support? Might not be needed.

export abstract class Algorithm {
    protected cached: ITagMap = {};
    protected sortAlgorithms: ITagSortingMap;
    protected rooms: Room[] = [];
    protected roomsByTag: {
        // @ts-ignore - TS wants this to be a string but we know better
        [tagId: TagID]: Room[];
    } = {};

    protected constructor() {
    }

    /**
     * Asks the Algorithm to regenerate all lists, using the tags given
     * as reference for which lists to generate and which way to generate
     * them.
     * @param {ITagSortingMap} tagSortingMap The tags to generate.
     * @returns {Promise<*>} A promise which resolves when complete.
     */
    public async populateTags(tagSortingMap: ITagSortingMap): Promise<any> {
        if (!tagSortingMap) throw new Error(`Map cannot be null or empty`);
        this.sortAlgorithms = tagSortingMap;
        return this.setKnownRooms(this.rooms);
    }

    /**
     * Gets an ordered set of rooms for the all known tags.
     * @returns {ITagMap} The cached list of rooms, ordered,
     * for each tag. May be empty, but never null/undefined.
     */
    public getOrderedRooms(): ITagMap {
        return this.cached;
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

        this.rooms = rooms;

        const newTags: ITagMap = {};
        for (const tagId in this.sortAlgorithms) {
            // noinspection JSUnfilteredForInLoop
            newTags[tagId] = [];
        }

        // If we can avoid doing work, do so.
        if (!rooms.length) {
            await this.generateFreshTags(newTags); // just in case it wants to do something
            this.cached = newTags;
            return;
        }

        // Split out the easy rooms first (leave and invite)
        const memberships = splitRoomsByMembership(rooms);
        for (const room of memberships[EffectiveMembership.Invite]) {
            console.log(`[DEBUG] "${room.name}" (${room.roomId}) is an Invite`);
            newTags[DefaultTagID.Invite].push(room);
        }
        for (const room of memberships[EffectiveMembership.Leave]) {
            console.log(`[DEBUG] "${room.name}" (${room.roomId}) is Historical`);
            newTags[DefaultTagID.Archived].push(room);
        }

        // Now process all the joined rooms. This is a bit more complicated
        for (const room of memberships[EffectiveMembership.Join]) {
            const tags = Object.keys(room.tags || {});

            let inTag = false;
            if (tags.length > 0) {
                for (const tag of tags) {
                    if (!isNullOrUndefined(newTags[tag])) {
                        console.log(`[DEBUG] "${room.name}" (${room.roomId}) is tagged as ${tag}`);
                        newTags[tag].push(room);
                        inTag = true;
                    }
                }
            }

            if (!inTag) {
                // TODO: Determine if DM and push there instead
                newTags[DefaultTagID.Untagged].push(room);
                console.log(`[DEBUG] "${room.name}" (${room.roomId}) is Untagged`);
            }
        }

        await this.generateFreshTags(newTags);

        this.cached = newTags;
    }

    /**
     * Called when the Algorithm believes a complete regeneration of the existing
     * lists is needed.
     * @param {ITagMap} updatedTagMap The tag map which needs populating. Each tag
     * will already have the rooms which belong to it - they just need ordering. Must
     * be mutated in place.
     * @returns {Promise<*>} A promise which resolves when complete.
     */
    protected abstract generateFreshTags(updatedTagMap: ITagMap): Promise<any>;

    /**
     * Called when the Algorithm wants a whole tag to be reordered. Typically this will
     * be done whenever the tag's scope changes (added/removed rooms).
     * @param {TagID} tagId The tag ID which changed.
     * @param {Room[]} rooms The rooms within the tag, unordered.
     * @returns {Promise<Room[]>} Resolves to the ordered rooms in the tag.
     */
    protected abstract regenerateTag(tagId: TagID, rooms: Room[]): Promise<Room[]>;

    /**
     * Asks the Algorithm to update its knowledge of a room. For example, when
     * a user tags a room, joins/creates a room, or leaves a room the Algorithm
     * should be told that the room's info might have changed. The Algorithm
     * may no-op this request if no changes are required.
     * @param {Room} room The room which might have affected sorting.
     * @returns {Promise<boolean>} A promise which resolve to true or false
     * depending on whether or not getOrderedRooms() should be called after
     * processing.
     */
    // TODO: Take a ReasonForChange to better predict the behaviour?
    // TODO: Intercept here and handle tag changes automatically
    public abstract handleRoomUpdate(room: Room): Promise<boolean>;
}

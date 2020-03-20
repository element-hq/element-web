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

import { TagID } from "../models";
import { Room } from "matrix-js-sdk/src/models/room";


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

export enum Category {
    Red = "RED",
    Grey = "GREY",
    Bold = "BOLD",
    Idle = "IDLE",
}

export interface ITagSortingMap {
    // @ts-ignore - TypeScript really wants this to be [tagId: string] but we know better.
    [tagId: TagID]: SortAlgorithm;
}

export interface ITagMap {
    // @ts-ignore - TypeScript really wants this to be [tagId: string] but we know better.
    [tagId: TagID]: Room[];
}

// TODO: Convert IAlgorithm to an abstract class?
// TODO: Add locking support to avoid concurrent writes
// TODO: EventEmitter support

/**
 * Represents an algorithm for the RoomListStore to use
 */
export interface IAlgorithm {
    /**
     * Asks the Algorithm to regenerate all lists, using the tags given
     * as reference for which lists to generate and which way to generate
     * them.
     * @param {ITagSortingMap} tagSortingMap The tags to generate.
     * @returns {Promise<*>} A promise which resolves when complete.
     */
    populateTags(tagSortingMap: ITagSortingMap): Promise<any>;

    /**
     * Gets an ordered set of rooms for the all known tags.
     * @returns {ITagMap} The cached list of rooms, ordered,
     * for each tag. May be empty, but never null/undefined.
     */
    getOrderedRooms(): ITagMap;

    /**
     * Seeds the Algorithm with a set of rooms. The algorithm will discard all
     * previously known information and instead use these rooms instead.
     * @param {Room[]} rooms The rooms to force the algorithm to use.
     * @returns {Promise<*>} A promise which resolves when complete.
     */
    setKnownRooms(rooms: Room[]): Promise<any>;

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
    handleRoomUpdate(room: Room): Promise<boolean>;
}

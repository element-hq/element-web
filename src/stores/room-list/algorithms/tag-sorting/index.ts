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

import { SortAlgorithm } from "../models";
import { ManualAlgorithm } from "./ManualAlgorithm";
import { IAlgorithm } from "./IAlgorithm";
import { TagID } from "../../models";
import { RecentAlgorithm } from "./RecentAlgorithm";
import { AlphabeticAlgorithm } from "./AlphabeticAlgorithm";

const ALGORITHM_INSTANCES: { [algorithm in SortAlgorithm]: IAlgorithm } = {
    [SortAlgorithm.Recent]: new RecentAlgorithm(),
    [SortAlgorithm.Alphabetic]: new AlphabeticAlgorithm(),
    [SortAlgorithm.Manual]: new ManualAlgorithm(),
};

/**
 * Gets an instance of the defined algorithm
 * @param {SortAlgorithm} algorithm The algorithm to get an instance of.
 * @returns {IAlgorithm} The algorithm instance.
 */
export function getSortingAlgorithmInstance(algorithm: SortAlgorithm): IAlgorithm {
    if (!ALGORITHM_INSTANCES[algorithm]) {
        throw new Error(`${algorithm} is not a known algorithm`);
    }

    return ALGORITHM_INSTANCES[algorithm];
}

/**
 * Sorts rooms in a given tag according to the algorithm given.
 * @param {Room[]} rooms The rooms to sort.
 * @param {TagID} tagId The tag in which the sorting is occurring.
 * @param {SortAlgorithm} algorithm The algorithm to use for sorting.
 * @returns {Room[]} Returns the sorted rooms.
 */
export function sortRoomsWithAlgorithm(rooms: Room[], tagId: TagID, algorithm: SortAlgorithm): Room[] {
    return getSortingAlgorithmInstance(algorithm).sortRooms(rooms, tagId);
}

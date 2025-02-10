/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";

import { SortAlgorithm } from "../models";
import { ManualAlgorithm } from "./ManualAlgorithm";
import { type IAlgorithm } from "./IAlgorithm";
import { type TagID } from "../../models";
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

/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";

export interface Sorter {
    /**
     * Performs an initial sort of rooms and returns a new array containing
     * the result.
     * @param rooms An array of rooms.
     */
    sort(rooms: Room[]): Room[];
    /**
     * The comparator used for sorting.
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#comparefn
     * @param roomA Room
     * @param roomB Room
     */
    comparator(roomA: Room, roomB: Room): number;
    /**
     * A string that uniquely identifies this given sorter.
     */
    type: SortingAlgorithm;
}

/**
 * All the available sorting algorithms.
 */
export const enum SortingAlgorithm {
    Recency = "Recency",
    Alphabetic = "Alphabetic",
}

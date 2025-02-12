/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";

import { type TagID } from "../../models";

/**
 * Represents a tag sorting algorithm.
 */
export interface IAlgorithm {
    /**
     * Sorts the given rooms according to the sorting rules of the algorithm.
     * @param {Room[]} rooms The rooms to sort.
     * @param {TagID} tagId The tag ID in which the rooms are being sorted.
     * @returns {Room[]} Returns the sorted rooms.
     */
    sortRooms(rooms: Room[], tagId: TagID): Room[];
}

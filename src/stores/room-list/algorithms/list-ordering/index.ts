/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ImportanceAlgorithm } from "./ImportanceAlgorithm";
import { ListAlgorithm, type SortAlgorithm } from "../models";
import { NaturalAlgorithm } from "./NaturalAlgorithm";
import { type TagID } from "../../models";
import { type OrderingAlgorithm } from "./OrderingAlgorithm";

interface AlgorithmFactory {
    (tagId: TagID, initialSortingAlgorithm: SortAlgorithm): OrderingAlgorithm;
}

const ALGORITHM_FACTORIES: { [algorithm in ListAlgorithm]: AlgorithmFactory } = {
    [ListAlgorithm.Natural]: (tagId, initSort) => new NaturalAlgorithm(tagId, initSort),
    [ListAlgorithm.Importance]: (tagId, initSort) => new ImportanceAlgorithm(tagId, initSort),
};

/**
 * Gets an instance of the defined algorithm
 * @param {ListAlgorithm} algorithm The algorithm to get an instance of.
 * @param {TagID} tagId The tag the algorithm is for.
 * @param {SortAlgorithm} initSort The initial sorting algorithm for the ordering algorithm.
 * @returns {Algorithm} The algorithm instance.
 */
export function getListAlgorithmInstance(
    algorithm: ListAlgorithm,
    tagId: TagID,
    initSort: SortAlgorithm,
): OrderingAlgorithm {
    if (!ALGORITHM_FACTORIES[algorithm]) {
        throw new Error(`${algorithm} is not a known algorithm`);
    }

    return ALGORITHM_FACTORIES[algorithm](tagId, initSort);
}

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

import { ImportanceAlgorithm } from "./ImportanceAlgorithm";
import { ListAlgorithm, SortAlgorithm } from "../models";
import { NaturalAlgorithm } from "./NaturalAlgorithm";
import { TagID } from "../../models";
import { OrderingAlgorithm } from "./OrderingAlgorithm";

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

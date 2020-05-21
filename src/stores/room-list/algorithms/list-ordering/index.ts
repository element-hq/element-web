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

import { Algorithm } from "./Algorithm";
import { ImportanceAlgorithm } from "./ImportanceAlgorithm";
import { ListAlgorithm } from "../models";
import { NaturalAlgorithm } from "./NaturalAlgorithm";

const ALGORITHM_FACTORIES: { [algorithm in ListAlgorithm]: () => Algorithm } = {
    [ListAlgorithm.Natural]: () => new NaturalAlgorithm(),
    [ListAlgorithm.Importance]: () => new ImportanceAlgorithm(),
};

/**
 * Gets an instance of the defined algorithm
 * @param {ListAlgorithm} algorithm The algorithm to get an instance of.
 * @returns {Algorithm} The algorithm instance.
 */
export function getListAlgorithmInstance(algorithm: ListAlgorithm): Algorithm {
    if (!ALGORITHM_FACTORIES[algorithm]) {
        throw new Error(`${algorithm} is not a known algorithm`);
    }

    return ALGORITHM_FACTORIES[algorithm]();
}

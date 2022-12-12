/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { arrayDiff, Diff } from "./arrays";

/**
 * Determines if two sets are different through a shallow comparison.
 * @param a The first set. Must be defined.
 * @param b The second set. Must be defined.
 * @returns True if they are different, false otherwise.
 */
export function setHasDiff<T>(a: Set<T>, b: Set<T>): boolean {
    if (a.size === b.size) {
        // When the lengths are equal, check to see if either set is missing an element from the other.
        if (Array.from(b).some((i) => !a.has(i))) return true;
        if (Array.from(a).some((i) => !b.has(i))) return true;

        // if all the keys are common, say so
        return false;
    } else {
        return true; // different lengths means they are naturally diverged
    }
}

/**
 * Determines the values added and removed between two sets.
 * @param a The first set. Must be defined.
 * @param b The second set. Must be defined.
 * @returns The difference between the values in each set.
 */
export function setDiff<T>(a: Set<T>, b: Set<T>): Diff<T> {
    return arrayDiff(Array.from(a), Array.from(b));
}

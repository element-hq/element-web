/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { arrayDiff, type Diff } from "./arrays";

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

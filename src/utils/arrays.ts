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

/**
 * Determines if two arrays are different through a shallow comparison.
 * @param a The first array. Must be defined.
 * @param b The second array. Must be defined.
 * @returns True if they are the same, false otherwise.
 */
export function arrayHasDiff(a: any[], b: any[]): boolean {
    if (a.length === b.length) {
        // When the lengths are equal, check to see if either array is missing
        // an element from the other.
        if (b.some(i => !a.includes(i))) return true;
        if (a.some(i => !b.includes(i))) return true;
    } else {
        return true; // different lengths means they are naturally diverged
    }
}

/**
 * Performs a diff on two arrays. The result is what is different with the
 * first array (`added` in the returned object means objects in B that aren't
 * in A). Shallow comparisons are used to perform the diff.
 * @param a The first array. Must be defined.
 * @param b The second array. Must be defined.
 * @returns The diff between the arrays.
 */
export function arrayDiff<T>(a: T[], b: T[]): { added: T[], removed: T[] } {
    return {
        added: b.filter(i => !a.includes(i)),
        removed: a.filter(i => !b.includes(i)),
    };
}

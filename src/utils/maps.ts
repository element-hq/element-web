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

import { arrayDiff, arrayMerge, arrayUnion } from "./arrays";

/**
 * Determines the keys added, changed, and removed between two Maps.
 * For changes, simple triple equal comparisons are done, not in-depth tree checking.
 * @param a The first Map. Must be defined.
 * @param b The second Map. Must be defined.
 * @returns The difference between the keys of each Map.
 */
export function mapDiff<K, V>(a: Map<K, V>, b: Map<K, V>): { changed: K[], added: K[], removed: K[] } {
    const aKeys = [...a.keys()];
    const bKeys = [...b.keys()];
    const keyDiff = arrayDiff(aKeys, bKeys);
    const possibleChanges = arrayUnion(aKeys, bKeys);
    const changes = possibleChanges.filter(k => a.get(k) !== b.get(k));

    return {changed: changes, added: keyDiff.added, removed: keyDiff.removed};
}

/**
 * Gets all the key changes (added, removed, or value difference) between two Maps.
 * Triple equals is used to compare values, not in-depth tree checking.
 * @param a The first Map. Must be defined.
 * @param b The second Map. Must be defined.
 * @returns The keys which have been added, removed, or changed between the two Maps.
 */
export function mapKeyChanges<K, V>(a: Map<K, V>, b: Map<K, V>): K[] {
    const diff = mapDiff(a, b);
    return arrayMerge(diff.removed, diff.added, diff.changed);
}

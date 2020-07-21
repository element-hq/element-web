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
 * Determines the keys added, changed, and removed between two objects.
 * For changes, simple triple equal comparisons are done, not in-depth
 * tree checking.
 * @param a The first object. Must be defined.
 * @param b The second object. Must be defined.
 * @returns The difference between the keys of each object.
 */
export function objectDiff(a: any, b: any): { changed: string[], added: string[], removed: string[] } {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    const keyDiff = arrayDiff(aKeys, bKeys);
    const possibleChanges = arrayUnion(aKeys, bKeys);
    const changes = possibleChanges.filter(k => a[k] !== b[k]);

    return {changed: changes, added: keyDiff.added, removed: keyDiff.removed};
}

/**
 * Gets all the key changes (added, removed, or value difference) between
 * two objects. Triple equals is used to compare values, not in-depth tree
 * checking.
 * @param a The first object. Must be defined.
 * @param b The second object. Must be defined.
 * @returns The keys which have been added, removed, or changed between the
 * two objects.
 */
export function objectKeyChanges(a: any, b: any): string[] {
    const diff = objectDiff(a, b);
    return arrayMerge(diff.removed, diff.added, diff.changed);
}

/**
 * Clones an object by running it through JSON parsing. Note that this
 * will destroy any complicated object types which do not translate to
 * JSON.
 * @param obj The object to clone.
 * @returns The cloned object
 */
export function objectClone(obj: any): any {
    return JSON.parse(JSON.stringify(obj));
}

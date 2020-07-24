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

import { arrayDiff, arrayHasDiff, arrayMerge, arrayUnion } from "./arrays";

/**
 * Gets a new object which represents the provided object, excluding some properties.
 * @param a The object to strip properties of. Must be defined.
 * @param props The property names to remove.
 * @returns The new object without the provided properties.
 */
export function objectExcluding(a: any, props: string[]): any {
    // We use a Map to avoid hammering the `delete` keyword, which is slow and painful.
    const tempMap = new Map<string, any>(Object.entries(a));
    for (const prop of props) {
        tempMap.delete(prop);
    }

    // Convert the map to an object again
    return Array.from(tempMap.entries()).reduce((c, [k, v]) => {
        c[k] = v;
        return c;
    }, {});
}

/**
 * Clones an object to a caller-controlled depth. When a propertyCloner is supplied, the
 * object's properties will be passed through it with the return value used as the new
 * object's type. This is intended to be used to deep clone a reference, but without
 * having to deep clone the entire object. This function is safe to call recursively within
 * the propertyCloner.
 * @param a The object to clone. Must be defined.
 * @param propertyCloner The function to clone the properties of the object with, optionally.
 * First argument is the property key with the second being the current value.
 * @returns A cloned object.
 */
export function objectShallowClone(a: any, propertyCloner?: (k: string, v: any) => any): any {
    const newObj = {};
    for (const [k, v] of Object.entries(a)) {
        newObj[k] = v;
        if (propertyCloner) {
            newObj[k] = propertyCloner(k, v);
        }
    }
    return newObj;
}

/**
 * Determines if the two objects, which are assumed to be of the same
 * key shape, have a difference in their values. If a difference is
 * determined, true is returned.
 * @param a The first object. Must be defined.
 * @param b The second object. Must be defined.
 * @returns True if there's a perceptual difference in the object's values.
 */
export function objectHasValueChange(a: any, b: any): boolean {
    const aValues = Object.values(a);
    const bValues = Object.values(b);
    return arrayHasDiff(aValues, bValues);
}

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

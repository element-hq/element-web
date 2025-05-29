/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { arrayDiff, arrayUnion, arrayIntersection } from "./arrays";

type ObjectExcluding<O extends object, P extends (keyof O)[]> = { [k in Exclude<keyof O, P[number]>]: O[k] };

/**
 * Gets a new object which represents the provided object, excluding some properties.
 * @param a The object to strip properties of. Must be defined.
 * @param props The property names to remove.
 * @returns The new object without the provided properties.
 */
export function objectExcluding<O extends object, P extends Array<keyof O>>(a: O, props: P): ObjectExcluding<O, P> {
    // We use a Map to avoid hammering the `delete` keyword, which is slow and painful.
    const tempMap = new Map<keyof O, any>(Object.entries(a) as [keyof O, any][]);
    for (const prop of props) {
        tempMap.delete(prop);
    }

    // Convert the map to an object again
    return Array.from(tempMap.entries()).reduce((c, [k, v]) => {
        c[k] = v;
        return c;
    }, {} as O);
}

/**
 * Gets a new object which represents the provided object, with only some properties
 * included.
 * @param a The object to clone properties of. Must be defined.
 * @param props The property names to keep.
 * @returns The new object with only the provided properties.
 */
export function objectWithOnly<O extends object, P extends Array<keyof O>>(a: O, props: P): { [k in P[number]]: O[k] } {
    const existingProps = Object.keys(a) as (keyof O)[];
    const diff = arrayDiff(existingProps, props);
    if (diff.removed.length === 0) {
        return objectShallowClone(a);
    } else {
        return objectExcluding(a, diff.removed) as { [k in P[number]]: O[k] };
    }
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
export function objectShallowClone<O extends object>(a: O, propertyCloner?: (k: keyof O, v: O[keyof O]) => any): O {
    const newObj = {} as O;
    for (const [k, v] of Object.entries(a) as [keyof O, O[keyof O]][]) {
        newObj[k] = v;
        if (propertyCloner) {
            newObj[k] = propertyCloner(k, v);
        }
    }
    return newObj;
}

/**
 * Determines if any keys were added, removed, or changed between two objects.
 * For changes, simple triple equal comparisons are done, not in-depth
 * tree checking.
 * @param a The first object. Must be defined.
 * @param b The second object. Must be defined.
 * @returns True if there's a difference between the objects, false otherwise
 */
export function objectHasDiff<O extends object>(a: O, b: O): boolean {
    if (a === b) return false;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return true;
    const possibleChanges = arrayIntersection(aKeys, bKeys) as Array<keyof O>;
    // if the amalgamation of both sets of keys has the a different length to the inputs then there must be a change
    if (possibleChanges.length !== aKeys.length) return true;

    return possibleChanges.some((k) => a[k] !== b[k]);
}

type Diff<K> = { changed: K[]; added: K[]; removed: K[] };

/**
 * Determines the keys added, changed, and removed between two objects.
 * For changes, simple triple equal comparisons are done, not in-depth
 * tree checking.
 * @param a The first object. Must be defined.
 * @param b The second object. Must be defined.
 * @returns The difference between the keys of each object.
 */
export function objectDiff<O extends object>(a: O, b: O): Diff<keyof O> {
    const aKeys = Object.keys(a) as (keyof O)[];
    const bKeys = Object.keys(b) as (keyof O)[];
    const keyDiff = arrayDiff(aKeys, bKeys);
    const possibleChanges = arrayIntersection(aKeys, bKeys);
    const changes = possibleChanges.filter((k) => a[k] !== b[k]);

    return { changed: changes, added: keyDiff.added, removed: keyDiff.removed };
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
export function objectKeyChanges<O extends object>(a: O, b: O): (keyof O)[] {
    const diff = objectDiff(a, b);
    return arrayUnion(diff.removed, diff.added, diff.changed);
}

/**
 * Clones an object by running it through JSON parsing. Note that this
 * will destroy any complicated object types which do not translate to
 * JSON.
 * @param obj The object to clone.
 * @returns The cloned object
 */
export function objectClone<O extends object>(obj: O): O {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export function isObject(item: any): item is object {
    return item && typeof item === "object" && !Array.isArray(item);
}

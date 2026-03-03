/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { arrayDiff, arrayIntersection } from "./arrays";

/**
 * Determines the keys added, changed, and removed between two Maps.
 * For changes, simple triple equal comparisons are done, not in-depth tree checking.
 * @param a The first Map. Must be defined.
 * @param b The second Map. Must be defined.
 * @returns The difference between the keys of each Map.
 */
export function mapDiff<K, V>(a: Map<K, V>, b: Map<K, V>): { changed: K[]; added: K[]; removed: K[] } {
    const aKeys = [...a.keys()];
    const bKeys = [...b.keys()];
    const keyDiff = arrayDiff(aKeys, bKeys);
    const possibleChanges = arrayIntersection(aKeys, bKeys);
    const changes = possibleChanges.filter((k) => a.get(k) !== b.get(k));

    return { changed: changes, added: keyDiff.added, removed: keyDiff.removed };
}

/**
 * A Map<K, V> with added utility.
 */
export class EnhancedMap<K, V> extends Map<K, V> {
    public constructor(entries?: Iterable<[K, V]>) {
        super(entries);
    }

    public getOrCreate(key: K, def: V): V {
        if (this.has(key)) {
            return this.get(key)!;
        }
        this.set(key, def);
        return def;
    }

    public remove(key: K): V | undefined {
        const v = this.get(key);
        this.delete(key);
        return v;
    }
}

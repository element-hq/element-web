/*
Copyright 2024 New Vector Ltd.
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2018 New Vector Ltd
Copyright 2017 Aviral Dasgupta

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { at, uniq } from "lodash";
import { removeHiddenChars } from "matrix-js-sdk/src/utils";

import { type TimelineRenderingType } from "../contexts/RoomContext";
import { type Leaves } from "../@types/common";

interface IOptions<T extends object> {
    keys: Array<Leaves<T>>;
    funcs?: Array<(o: T) => string | string[]>;
    shouldMatchWordsOnly?: boolean;
    // whether to apply unhomoglyph and strip diacritics to fuzz up the search. Defaults to true
    fuzzy?: boolean;
    context?: TimelineRenderingType;
}

/**
 * Simple search matcher that matches any results with the query string anywhere
 * in the search string. Returns matches in the order the query string appears
 * in the search key, earliest first, then in the order the search key appears
 * in the provided array of keys, then in the order the items appeared in the
 * source array.
 *
 * @param {Object[]} objects Initial list of objects. Equivalent to calling
 *     setObjects() after construction
 * @param {Object} options Options object
 * @param {string[]} options.keys List of keys to use as indexes on the objects
 * @param {function[]} options.funcs List of functions that when called with the
 *     object as an arg will return a string to use as an index
 */
export default class QueryMatcher<T extends object> {
    private _options: IOptions<T>;
    private _items = new Map<string, { object: T; keyWeight: number }[]>();

    public constructor(objects: T[], options: IOptions<T> = { keys: [] }) {
        this._options = options;

        this.setObjects(objects);

        // By default, we remove any non-alphanumeric characters ([^A-Za-z0-9_]) from the
        // query and the value being queried before matching
        if (this._options.shouldMatchWordsOnly === undefined) {
            this._options.shouldMatchWordsOnly = true;
        }
    }

    public setObjects(objects: T[]): void {
        this._items = new Map();

        for (const object of objects) {
            // Need to use unsafe coerce here because the objects can have any
            // type for their values. We assume that those values who's keys have
            // been specified will be string. Also, we cannot infer all the
            // types of the keys of the objects at compile.
            const keyValues = at<string>(<any>object, this._options.keys);

            if (this._options.funcs) {
                for (const f of this._options.funcs) {
                    const v = f(object);
                    if (Array.isArray(v)) {
                        keyValues.push(...v);
                    } else {
                        keyValues.push(v);
                    }
                }
            }

            for (const [index, keyValue] of Object.entries(keyValues)) {
                if (!keyValue) continue; // skip falsy keyValues
                const key = this.processQuery(keyValue);
                if (!this._items.has(key)) {
                    this._items.set(key, []);
                }
                this._items.get(key)!.push({
                    keyWeight: Number(index),
                    object,
                });
            }
        }
    }

    public match(query: string, limit = -1): T[] {
        query = this.processQuery(query);
        if (this._options.shouldMatchWordsOnly) {
            query = query.replace(/[^\w]/g, "");
        }
        if (query.length === 0) {
            return [];
        }
        const matches: {
            index: number;
            object: T;
            keyWeight: number;
        }[] = [];
        // Iterate through the map & check each key.
        // ES6 Map iteration order is defined to be insertion order, so results
        // here will come out in the order they were put in.
        for (const [key, candidates] of this._items.entries()) {
            let resultKey = key;
            if (this._options.shouldMatchWordsOnly) {
                resultKey = resultKey.replace(/[^\w]/g, "");
            }
            const index = resultKey.indexOf(query);
            if (index !== -1) {
                matches.push(...candidates.map((candidate) => ({ index, ...candidate })));
            }
        }

        // Sort matches by where the query appeared in the search key, then by
        // where the matched key appeared in the provided array of keys.
        matches.sort((a, b) => {
            if (a.index < b.index) {
                return -1;
            } else if (a.index === b.index) {
                if (a.keyWeight < b.keyWeight) {
                    return -1;
                } else if (a.keyWeight === b.keyWeight) {
                    return 0;
                }
            }

            return 1;
        });

        // Now map the keys to the result objects. Also remove any duplicates.
        const dedupped = uniq(matches.map((match) => match.object));
        const maxLength = limit === -1 ? dedupped.length : limit;

        return dedupped.slice(0, maxLength);
    }

    private processQuery(query: string): string {
        if (this._options.fuzzy !== false) {
            // lower case both the input and the output for consistency
            return removeHiddenChars(query.toLowerCase()).toLowerCase();
        }
        return query.toLowerCase();
    }
}

/*
Copyright 2017 Aviral Dasgupta
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2018 New Vector Ltd

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

import _at from 'lodash/at';
import _flatMap from 'lodash/flatMap';
import _sortBy from 'lodash/sortBy';
import _uniq from 'lodash/uniq';

function stripDiacritics(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

interface IOptions<T extends {}> {
    keys: Array<string | keyof T>;
    funcs?: Array<(T) => string>;
    shouldMatchWordsOnly?: boolean;
    shouldMatchPrefix?: boolean;
}

/**
 * Simple search matcher that matches any results with the query string anywhere
 * in the search string. Returns matches in the order the query string appears
 * in the search key, earliest first, then in the order the items appeared in
 * the source array.
 *
 * @param {Object[]} objects Initial list of objects. Equivalent to calling
 *     setObjects() after construction
 * @param {Object} options Options object
 * @param {string[]} options.keys List of keys to use as indexes on the objects
 * @param {function[]} options.funcs List of functions that when called with the
 *     object as an arg will return a string to use as an index
 */
export default class QueryMatcher<T extends Object> {
    private _options: IOptions<T>;
    private _keys: IOptions<T>["keys"];
    private _funcs: Required<IOptions<T>["funcs"]>;
    private _items: Map<string, T[]>;

    constructor(objects: T[], options: IOptions<T> = { keys: [] }) {
        this._options = options;
        this._keys = options.keys;
        this._funcs = options.funcs || [];

        this.setObjects(objects);

        // By default, we remove any non-alphanumeric characters ([^A-Za-z0-9_]) from the
        // query and the value being queried before matching
        if (this._options.shouldMatchWordsOnly === undefined) {
            this._options.shouldMatchWordsOnly = true;
        }

        // By default, match anywhere in the string being searched. If enabled, only return
        // matches that are prefixed with the query.
        if (this._options.shouldMatchPrefix === undefined) {
            this._options.shouldMatchPrefix = false;
        }
    }

    setObjects(objects: T[]) {
        this._items = new Map();

        for (const object of objects) {
            // Need to use unsafe coerce here because the objects can have any
            // type for their values. We assume that those values who's keys have
            // been specified will be string. Also, we cannot infer all the
            // types of the keys of the objects at compile.
            const keyValues = _at<string>(<any>object, this._keys);

            for (const f of this._funcs) {
                keyValues.push(f(object));
            }

            for (const keyValue of keyValues) {
                if (!keyValue) continue; // skip falsy keyValues
                const key = stripDiacritics(keyValue).toLowerCase();
                if (!this._items.has(key)) {
                    this._items.set(key, []);
                }
                this._items.get(key).push(object);
            }
        }
    }

    match(query: string): T[] {
        query = stripDiacritics(query).toLowerCase();
        if (this._options.shouldMatchWordsOnly) {
            query = query.replace(/[^\w]/g, '');
        }
        if (query.length === 0) {
            return [];
        }
        const results = [];
        // Iterate through the map & check each key.
        // ES6 Map iteration order is defined to be insertion order, so results
        // here will come out in the order they were put in.
        for (const key of this._items.keys()) {
            let resultKey = key;
            if (this._options.shouldMatchWordsOnly) {
                resultKey = resultKey.replace(/[^\w]/g, '');
            }
            const index = resultKey.indexOf(query);
            if (index !== -1 && (!this._options.shouldMatchPrefix || index === 0)) {
                results.push({key, index});
            }
        }

        // Sort them by where the query appeared in the search key
        // lodash sortBy is a stable sort, so results where the query
        // appeared in the same place will retain their order with
        // respect to each other.
        const sortedResults = _sortBy(results, (candidate) => {
            return candidate.index;
        });

        // Now map the keys to the result objects. Each result object is a list, so
        // flatMap will flatten those lists out into a single list. Also remove any
        // duplicates.
        return _uniq(_flatMap(sortedResults, (candidate) => this._items.get(candidate.key)));
    }
}

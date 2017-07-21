//@flow
/*
Copyright 2017 Aviral Dasgupta

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
import _keys from 'lodash/keys';

class KeyMap {
    keys: Array<String>;
    objectMap: {[String]: Array<Object>};
    priorityMap = new Map();
}

export default class QueryMatcher {
    /**
     * @param {object[]} objects the objects to perform a match on
     * @param {string[]} keys an array of keys within each object to match on
     * Keys can refer to object properties by name and as in JavaScript (for nested properties)
     *
     * To use, simply presort objects by required criteria, run through this function and create a QueryMatcher with the
     * resulting KeyMap.
     *
     * TODO: Handle arrays and objects (Fuse did this, RoomProvider uses it)
     * @return {KeyMap}
     */
    static valuesToKeyMap(objects: Array<Object>, keys: Array<String>): KeyMap {
        const keyMap = new KeyMap();
        const map = {};

        objects.forEach((object, i) => {
            const keyValues = _at(object, keys);
            for (const keyValue of keyValues) {
                if (!map.hasOwnProperty(keyValue)) {
                    map[keyValue] = [];
                }
                map[keyValue].push(object);
            }
            keyMap.priorityMap.set(object, i);
        });

        keyMap.objectMap = map;
        keyMap.keys = _keys(map);
        return keyMap;
    }

    constructor(objects: Array<Object>, options: {[Object]: Object} = {}) {
        this.options = options;
        this.keys = options.keys;
        this.setObjects(objects);

        // By default, we remove any non-alphanumeric characters ([^A-Za-z0-9_]) from the
        // query and the value being queried before matching
        if (this.options.shouldMatchWordsOnly === undefined) {
            this.options.shouldMatchWordsOnly = true;
        }

        // By default, match anywhere in the string being searched. If enabled, only return
        // matches that are prefixed with the query.
        if (this.options.shouldMatchPrefix === undefined) {
            this.options.shouldMatchPrefix = false;
        }
    }

    setObjects(objects: Array<Object>) {
        this.keyMap = QueryMatcher.valuesToKeyMap(objects, this.keys);
    }

    match(query: String): Array<Object> {
        query = query.toLowerCase();
        if (this.options.shouldMatchWordsOnly) {
            query = query.replace(/[^\w]/g, '');
        }
        if (query.length === 0) {
            return [];
        }
        const results = [];
        this.keyMap.keys.forEach((key) => {
            let resultKey = key.toLowerCase();
            if (this.options.shouldMatchWordsOnly) {
                resultKey = resultKey.replace(/[^\w]/g, '');
            }
            const index = resultKey.indexOf(query);
            if (index !== -1 && (!this.options.shouldMatchPrefix || index === 0)) {
                results.push({key, index});
            }
        });

        return _uniq(_flatMap(_sortBy(results, (candidate) => {
            return candidate.index;
        }).map((candidate) => {
            // return an array of objects (those given to setObjects) that have the given
            // key as a property.
            return this.keyMap.objectMap[candidate.key];
        })));
    }
}

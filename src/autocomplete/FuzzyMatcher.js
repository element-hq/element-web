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

//import Levenshtein from 'liblevenshtein';
//import _at from 'lodash/at';
//import _flatMap from 'lodash/flatMap';
//import _sortBy from 'lodash/sortBy';
//import _sortedUniq from 'lodash/sortedUniq';
//import _keys from 'lodash/keys';
//
//class KeyMap {
//    keys: Array<String>;
//    objectMap: {[String]: Array<Object>};
//    priorityMap: {[String]: number}
//}
//
//const DEFAULT_RESULT_COUNT = 10;
//const DEFAULT_DISTANCE = 5;

// FIXME Until Fuzzy matching works better, we use prefix matching.

import PrefixMatcher from './QueryMatcher';
export default PrefixMatcher;

//class FuzzyMatcher { // eslint-disable-line no-unused-vars
//    /**
//     * @param {object[]} objects the objects to perform a match on
//     * @param {string[]} keys an array of keys within each object to match on
//     * Keys can refer to object properties by name and as in JavaScript (for nested properties)
//     *
//     * To use, simply presort objects by required criteria, run through this function and create a FuzzyMatcher with the
//     * resulting KeyMap.
//     *
//     * TODO: Handle arrays and objects (Fuse did this, RoomProvider uses it)
//     * @return {KeyMap}
//     */
//    static valuesToKeyMap(objects: Array<Object>, keys: Array<String>): KeyMap {
//        const keyMap = new KeyMap();
//        const map = {};
//        const priorities = {};
//
//        objects.forEach((object, i) => {
//            const keyValues = _at(object, keys);
//            console.log(object, keyValues, keys);
//            for (const keyValue of keyValues) {
//                if (!map.hasOwnProperty(keyValue)) {
//                   map[keyValue] = [];
//                }
//                map[keyValue].push(object);
//            }
//            priorities[object] = i;
//        });
//
//        keyMap.objectMap = map;
//        keyMap.priorityMap = priorities;
//        keyMap.keys = _sortBy(_keys(map), [(value) => priorities[value]]);
//        return keyMap;
//    }
//
//    constructor(objects: Array<Object>, options: {[Object]: Object} = {}) {
//        this.options = options;
//        this.keys = options.keys;
//        this.setObjects(objects);
//    }
//
//    setObjects(objects: Array<Object>) {
//        this.keyMap = FuzzyMatcher.valuesToKeyMap(objects, this.keys);
//        console.log(this.keyMap.keys);
//        this.matcher = new Levenshtein.Builder()
//            .dictionary(this.keyMap.keys, true)
//            .algorithm('transposition')
//            .sort_candidates(false)
//            .case_insensitive_sort(true)
//            .include_distance(true)
//            .maximum_candidates(this.options.resultCount || DEFAULT_RESULT_COUNT) // result count 0 doesn't make much sense
//            .build();
//    }
//
//    match(query: String): Array<Object> {
//        const candidates = this.matcher.transduce(query, this.options.distance || DEFAULT_DISTANCE);
//        // TODO FIXME This is hideous. Clean up when possible.
//        const val = _sortedUniq(_sortBy(_flatMap(candidates, (candidate) => {
//                return this.keyMap.objectMap[candidate[0]].map((value) => {
//                    return {
//                        distance: candidate[1],
//                        ...value,
//                    };
//                });
//            }),
//            [(candidate) => candidate.distance, (candidate) => this.keyMap.priorityMap[candidate]]));
//        console.log(val);
//        return val;
//    }
//}

import Levenshtein from 'liblevenshtein';
import _at from 'lodash/at';
import _flatMap from 'lodash/flatMap';
import _sortBy from 'lodash/sortBy';
import _sortedUniq from 'lodash/sortedUniq';
import _keys from 'lodash/keys';

class KeyMap {
    keys: Array<String>;
    objectMap: {[String]: Array<Object>};
    priorityMap: {[String]: number}
}

const DEFAULT_RESULT_COUNT = 10;
const DEFAULT_DISTANCE = 5;

export default class FuzzyMatcher {
    /**
     * Given an array of objects and keys, returns a KeyMap
     * Keys can refer to object properties by name and as in JavaScript (for nested properties)
     *
     * To use, simply presort objects by required criteria, run through this function and create a FuzzyMatcher with the
     * resulting KeyMap.
     *
     * TODO: Handle arrays and objects (Fuse did this, RoomProvider uses it)
     */
    static valuesToKeyMap(objects: Array<Object>, keys: Array<String>): KeyMap {
        const keyMap = new KeyMap();
        const map = {};
        const priorities = {};

        objects.forEach((object, i) => {
            const keyValues = _at(object, keys);
            console.log(object, keyValues, keys);
            for (const keyValue of keyValues) {
                if (!map.hasOwnProperty(keyValue)) {
                   map[keyValue] = [];
                }
                map[keyValue].push(object);
            }
            priorities[object] = i;
        });

        keyMap.objectMap = map;
        keyMap.priorityMap = priorities;
        keyMap.keys = _sortBy(_keys(map), [value => priorities[value]]);
        return keyMap;
    }

    constructor(objects: Array<Object>, options: {[Object]: Object} = {}) {
        this.options = options;
        this.keys = options.keys;
        this.setObjects(objects);
    }

    setObjects(objects: Array<Object>) {
        this.keyMap = FuzzyMatcher.valuesToKeyMap(objects, this.keys);
        console.log(this.keyMap.keys);
        this.matcher = new Levenshtein.Builder()
            .dictionary(this.keyMap.keys, true)
            .algorithm('transposition')
            .sort_candidates(false)
            .case_insensitive_sort(true)
            .include_distance(true)
            .maximum_candidates(this.options.resultCount || DEFAULT_RESULT_COUNT) // result count 0 doesn't make much sense
            .build();
    }

    match(query: String): Array<Object> {
        const candidates = this.matcher.transduce(query, this.options.distance || DEFAULT_DISTANCE);
        // TODO FIXME This is hideous. Clean up when possible.
        const val =  _sortedUniq(_sortBy(_flatMap(candidates, candidate => {
                return this.keyMap.objectMap[candidate[0]].map(value => {
                    return {
                        distance: candidate[1],
                        ...value,
                    };
                });
            }),
            [candidate => candidate.distance, candidate => this.keyMap.priorityMap[candidate]]));
        console.log(val);
        return val;
    }
}

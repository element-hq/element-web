//@flow

import _at from 'lodash/at';
import _flatMap from 'lodash/flatMap';
import _sortBy from 'lodash/sortBy';
import _sortedUniq from 'lodash/sortedUniq';
import _keys from 'lodash/keys';

class KeyMap {
    keys: Array<String>;
    objectMap: {[String]: Array<Object>};
    priorityMap = new Map();
}

export default class QueryMatcher {
    /**
     * Given an array of objects and keys, returns a KeyMap
     * Keys can refer to object properties by name and as in JavaScript (for nested properties)
     *
     * To use, simply presort objects by required criteria, run through this function and create a QueryMatcher with the
     * resulting KeyMap.
     *
     * TODO: Handle arrays and objects (Fuse did this, RoomProvider uses it)
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
    }

    setObjects(objects: Array<Object>) {
        this.keyMap = QueryMatcher.valuesToKeyMap(objects, this.keys);
    }

    match(query: String): Array<Object> {
        query = query.toLowerCase().replace(/[^\w]/g, '');
        const results = _sortedUniq(_sortBy(_flatMap(this.keyMap.keys, (key) => {
            return key.toLowerCase().replace(/[^\w]/g, '').indexOf(query) >= 0 ? this.keyMap.objectMap[key] : [];
        }), (candidate) => this.keyMap.priorityMap.get(candidate)));
        return results;
    }
}

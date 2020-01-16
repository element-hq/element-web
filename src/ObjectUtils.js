/*
Copyright 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

/**
 * For two objects of the form { key: [val1, val2, val3] }, work out the added/removed
 * values. Entirely new keys will result in the entire value array being added.
 * @param {Object} before
 * @param {Object} after
 * @return {Object[]} An array of objects with the form:
 * { key: $KEY, val: $VALUE, place: "add|del" }
 */
export function getKeyValueArrayDiffs(before, after) {
    const results = [];
    const delta = {};
    Object.keys(before).forEach(function(beforeKey) {
        delta[beforeKey] = delta[beforeKey] || 0; // init to 0 initially
        delta[beforeKey]--; // keys present in the past have -ve values
    });
    Object.keys(after).forEach(function(afterKey) {
        delta[afterKey] = delta[afterKey] || 0; // init to 0 initially
        delta[afterKey]++; // keys present in the future have +ve values
    });

    Object.keys(delta).forEach(function(muxedKey) {
        switch (delta[muxedKey]) {
            case 1: // A new key in after
                after[muxedKey].forEach(function(afterVal) {
                    results.push({ place: "add", key: muxedKey, val: afterVal });
                });
                break;
            case -1: // A before key was removed
                before[muxedKey].forEach(function(beforeVal) {
                    results.push({ place: "del", key: muxedKey, val: beforeVal });
                });
                break;
            case 0: {// A mix of added/removed keys
                // compare old & new vals
                const itemDelta = {};
                before[muxedKey].forEach(function(beforeVal) {
                    itemDelta[beforeVal] = itemDelta[beforeVal] || 0;
                    itemDelta[beforeVal]--;
                });
                after[muxedKey].forEach(function(afterVal) {
                    itemDelta[afterVal] = itemDelta[afterVal] || 0;
                    itemDelta[afterVal]++;
                });

                Object.keys(itemDelta).forEach(function(item) {
                    if (itemDelta[item] === 1) {
                        results.push({ place: "add", key: muxedKey, val: item });
                    } else if (itemDelta[item] === -1) {
                        results.push({ place: "del", key: muxedKey, val: item });
                    } else {
                        // itemDelta of 0 means it was unchanged between before/after
                    }
                });
                break;
            }
            default:
                console.error("Calculated key delta of " + delta[muxedKey] + " - this should never happen!");
                break;
        }
    });

    return results;
}

/**
 * Shallow-compare two objects for equality: each key and value must be identical
 * @param {Object} objA First object to compare against the second
 * @param {Object} objB Second object to compare against the first
 * @return {boolean} whether the two objects have same key=values
 */
export function shallowEqual(objA, objB) {
    if (objA === objB) {
        return true;
    }

    if (typeof objA !== 'object' || objA === null ||
          typeof objB !== 'object' || objB === null) {
        return false;
    }

    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) {
        return false;
    }

    for (let i = 0; i < keysA.length; i++) {
        const key = keysA[i];
        if (!objB.hasOwnProperty(key) || objA[key] !== objB[key]) {
            return false;
        }
    }

    return true;
}

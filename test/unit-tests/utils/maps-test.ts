/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EnhancedMap, mapDiff } from "../../../src/utils/maps";

describe("maps", () => {
    describe("mapDiff", () => {
        it("should indicate no differences when the pointers are the same", () => {
            const a = new Map([
                [1, 1],
                [2, 2],
                [3, 3],
            ]);
            const result = mapDiff(a, a);
            expect(result).toBeDefined();
            expect(result.added).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.changed).toBeDefined();
            expect(result.added).toHaveLength(0);
            expect(result.removed).toHaveLength(0);
            expect(result.changed).toHaveLength(0);
        });

        it("should indicate no differences when there are none", () => {
            const a = new Map([
                [1, 1],
                [2, 2],
                [3, 3],
            ]);
            const b = new Map([
                [1, 1],
                [2, 2],
                [3, 3],
            ]);
            const result = mapDiff(a, b);
            expect(result).toBeDefined();
            expect(result.added).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.changed).toBeDefined();
            expect(result.added).toHaveLength(0);
            expect(result.removed).toHaveLength(0);
            expect(result.changed).toHaveLength(0);
        });

        it("should indicate added properties", () => {
            const a = new Map([
                [1, 1],
                [2, 2],
                [3, 3],
            ]);
            const b = new Map([
                [1, 1],
                [2, 2],
                [3, 3],
                [4, 4],
            ]);
            const result = mapDiff(a, b);
            expect(result).toBeDefined();
            expect(result.added).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.changed).toBeDefined();
            expect(result.added).toHaveLength(1);
            expect(result.removed).toHaveLength(0);
            expect(result.changed).toHaveLength(0);
            expect(result.added).toEqual([4]);
        });

        it("should indicate removed properties", () => {
            const a = new Map([
                [1, 1],
                [2, 2],
                [3, 3],
            ]);
            const b = new Map([
                [1, 1],
                [2, 2],
            ]);
            const result = mapDiff(a, b);
            expect(result).toBeDefined();
            expect(result.added).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.changed).toBeDefined();
            expect(result.added).toHaveLength(0);
            expect(result.removed).toHaveLength(1);
            expect(result.changed).toHaveLength(0);
            expect(result.removed).toEqual([3]);
        });

        it("should indicate changed properties", () => {
            const a = new Map([
                [1, 1],
                [2, 2],
                [3, 3],
            ]);
            const b = new Map([
                [1, 1],
                [2, 2],
                [3, 4],
            ]); // note change
            const result = mapDiff(a, b);
            expect(result).toBeDefined();
            expect(result.added).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.changed).toBeDefined();
            expect(result.added).toHaveLength(0);
            expect(result.removed).toHaveLength(0);
            expect(result.changed).toHaveLength(1);
            expect(result.changed).toEqual([3]);
        });

        it("should indicate changed, added, and removed properties", () => {
            const a = new Map([
                [1, 1],
                [2, 2],
                [3, 3],
            ]);
            const b = new Map([
                [1, 1],
                [2, 8],
                [4, 4],
            ]); // note change
            const result = mapDiff(a, b);
            expect(result).toBeDefined();
            expect(result.added).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.changed).toBeDefined();
            expect(result.added).toHaveLength(1);
            expect(result.removed).toHaveLength(1);
            expect(result.changed).toHaveLength(1);
            expect(result.added).toEqual([4]);
            expect(result.removed).toEqual([3]);
            expect(result.changed).toEqual([2]);
        });

        it("should indicate changes for difference in pointers", () => {
            const a = new Map([[1, {}]]); // {} always creates a new object
            const b = new Map([[1, {}]]);
            const result = mapDiff(a, b);
            expect(result).toBeDefined();
            expect(result.added).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.changed).toBeDefined();
            expect(result.added).toHaveLength(0);
            expect(result.removed).toHaveLength(0);
            expect(result.changed).toHaveLength(1);
            expect(result.changed).toEqual([1]);
        });
    });

    describe("EnhancedMap", () => {
        // Most of these tests will make sure it implements the Map<K, V> class

        it("should be empty by default", () => {
            const result = new EnhancedMap();
            expect(result.size).toBe(0);
        });

        it("should use the provided entries", () => {
            const obj = { a: 1, b: 2 };
            const result = new EnhancedMap(Object.entries(obj));
            expect(result.size).toBe(2);
            expect(result.get("a")).toBe(1);
            expect(result.get("b")).toBe(2);
        });

        it("should create keys if they do not exist", () => {
            const key = "a";
            const val = {}; // we'll check pointers

            const result = new EnhancedMap<string, any>();
            expect(result.size).toBe(0);

            let get = result.getOrCreate(key, val);
            expect(get).toBeDefined();
            expect(get).toBe(val);
            expect(result.size).toBe(1);

            get = result.getOrCreate(key, 44); // specifically change `val`
            expect(get).toBeDefined();
            expect(get).toBe(val);
            expect(result.size).toBe(1);

            get = result.get(key); // use the base class function
            expect(get).toBeDefined();
            expect(get).toBe(val);
            expect(result.size).toBe(1);
        });

        it("should proxy remove to delete and return it", () => {
            const val = {};
            const result = new EnhancedMap<string, any>();
            result.set("a", val);

            expect(result.size).toBe(1);

            const removed = result.remove("a");
            expect(result.size).toBe(0);
            expect(removed).toBeDefined();
            expect(removed).toBe(val);
        });

        it("should support removing unknown keys", () => {
            const val = {};
            const result = new EnhancedMap<string, any>();
            result.set("a", val);

            expect(result.size).toBe(1);

            const removed = result.remove("not-a");
            expect(result.size).toBe(1);
            expect(removed).not.toBeDefined();
        });
    });
});

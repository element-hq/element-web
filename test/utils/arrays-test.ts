/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {
    arrayDiff,
    arrayFastClone,
    arrayFastResample,
    arrayHasDiff,
    arrayHasOrderChange,
    arrayUnion,
    arrayRescale,
    arraySeed,
    arraySmoothingResample,
    arrayTrimFill,
    arrayIntersection,
    ArrayUtil,
    GroupedArray,
    concat,
    asyncEvery,
    asyncSome,
} from "../../src/utils/arrays";

type TestParams = { input: number[]; output: number[] };
type TestCase = [string, TestParams];

function expectSample(input: number[], expected: number[], smooth = false) {
    const result = (smooth ? arraySmoothingResample : arrayFastResample)(input, expected.length);
    expect(result).toBeDefined();
    expect(result).toHaveLength(expected.length);
    expect(result).toEqual(expected);
}

describe("arrays", () => {
    describe("arrayFastResample", () => {
        const downsampleCases: TestCase[] = [
            ["Odd -> Even", { input: [1, 2, 3, 4, 5], output: [1, 4] }],
            ["Odd -> Odd", { input: [1, 2, 3, 4, 5], output: [1, 3, 5] }],
            ["Even -> Odd", { input: [1, 2, 3, 4], output: [1, 2, 3] }],
            ["Even -> Even", { input: [1, 2, 3, 4], output: [1, 3] }],
        ];
        it.each(downsampleCases)("downsamples correctly from %s", (_d, { input, output }) =>
            expectSample(input, output),
        );

        const upsampleCases: TestCase[] = [
            ["Odd -> Even", { input: [1, 2, 3], output: [1, 1, 2, 2, 3, 3] }],
            ["Odd -> Odd", { input: [1, 2, 3], output: [1, 1, 2, 2, 3] }],
            ["Even -> Odd", { input: [1, 2], output: [1, 1, 1, 2, 2] }],
            ["Even -> Even", { input: [1, 2], output: [1, 1, 1, 2, 2, 2] }],
        ];
        it.each(upsampleCases)("upsamples correctly from %s", (_d, { input, output }) => expectSample(input, output));

        const maintainSampleCases: TestCase[] = [
            ["Odd", { input: [1, 2, 3], output: [1, 2, 3] }], // Odd
            ["Even", { input: [1, 2], output: [1, 2] }], // Even
        ];

        it.each(maintainSampleCases)("maintains samples for %s", (_d, { input, output }) =>
            expectSample(input, output),
        );
    });

    describe("arraySmoothingResample", () => {
        // Dev note: these aren't great samples, but they demonstrate the bare minimum. Ideally
        // we'd be feeding a thousand values in and seeing what a curve of 250 values looks like,
        // but that's not really feasible to manually verify accuracy.
        const downsampleCases: TestCase[] = [
            ["Odd -> Even", { input: [4, 4, 1, 4, 4, 1, 4, 4, 1], output: [3, 3, 3, 3] }],
            ["Odd -> Odd", { input: [4, 4, 1, 4, 4, 1, 4, 4, 1], output: [3, 3, 3] }],
            ["Even -> Odd", { input: [4, 4, 1, 4, 4, 1, 4, 4], output: [3, 3, 3] }],
            ["Even -> Even", { input: [4, 4, 1, 4, 4, 1, 4, 4], output: [3, 3] }],
        ];

        it.each(downsampleCases)("downsamples correctly from %s", (_d, { input, output }) =>
            expectSample(input, output, true),
        );

        const upsampleCases: TestCase[] = [
            ["Odd -> Even", { input: [2, 0, 2], output: [2, 2, 0, 0, 2, 2] }],
            ["Odd -> Odd", { input: [2, 0, 2], output: [2, 2, 0, 0, 2] }],
            ["Even -> Odd", { input: [2, 0], output: [2, 2, 2, 0, 0] }],
            ["Even -> Even", { input: [2, 0], output: [2, 2, 2, 0, 0, 0] }],
        ];
        it.each(upsampleCases)("upsamples correctly from %s", (_d, { input, output }) =>
            expectSample(input, output, true),
        );

        const maintainCases: TestCase[] = [
            ["Odd", { input: [2, 0, 2], output: [2, 0, 2] }],
            ["Even", { input: [2, 0], output: [2, 0] }],
        ];
        it.each(maintainCases)("maintains samples for %s", (_d, { input, output }) => expectSample(input, output));
    });

    describe("arrayRescale", () => {
        it("should rescale", () => {
            const input = [8, 9, 1, 0, 2, 7, 10];
            const output = [80, 90, 10, 0, 20, 70, 100];
            const result = arrayRescale(input, 0, 100);
            expect(result).toBeDefined();
            expect(result).toHaveLength(output.length);
            expect(result).toEqual(output);
        });
    });

    describe("arrayTrimFill", () => {
        it("should shrink arrays", () => {
            const input = [1, 2, 3];
            const output = [1, 2];
            const seed = [4, 5, 6];
            const result = arrayTrimFill(input, output.length, seed);
            expect(result).toBeDefined();
            expect(result).toHaveLength(output.length);
            expect(result).toEqual(output);
        });

        it("should expand arrays", () => {
            const input = [1, 2, 3];
            const output = [1, 2, 3, 4, 5];
            const seed = [4, 5, 6];
            const result = arrayTrimFill(input, output.length, seed);
            expect(result).toBeDefined();
            expect(result).toHaveLength(output.length);
            expect(result).toEqual(output);
        });

        it("should keep arrays the same", () => {
            const input = [1, 2, 3];
            const output = [1, 2, 3];
            const seed = [4, 5, 6];
            const result = arrayTrimFill(input, output.length, seed);
            expect(result).toBeDefined();
            expect(result).toHaveLength(output.length);
            expect(result).toEqual(output);
        });
    });

    describe("arraySeed", () => {
        it("should create an array of given length", () => {
            const val = 1;
            const output = [val, val, val];
            const result = arraySeed(val, output.length);
            expect(result).toBeDefined();
            expect(result).toHaveLength(output.length);
            expect(result).toEqual(output);
        });
        it("should maintain pointers", () => {
            const val = {}; // this works because `{} !== {}`, which is what toEqual checks
            const output = [val, val, val];
            const result = arraySeed(val, output.length);
            expect(result).toBeDefined();
            expect(result).toHaveLength(output.length);
            expect(result).toEqual(output);
        });
    });

    describe("arrayFastClone", () => {
        it("should break pointer reference on source array", () => {
            const val = {}; // we'll test to make sure the values maintain pointers too
            const input = [val, val, val];
            const result = arrayFastClone(input);
            expect(result).toBeDefined();
            expect(result).toHaveLength(input.length);
            expect(result).toEqual(input); // we want the array contents to match...
            expect(result).not.toBe(input); // ... but be a different reference
        });
    });

    describe("arrayHasOrderChange", () => {
        it("should flag true on B ordering difference", () => {
            const a = [1, 2, 3];
            const b = [3, 2, 1];
            const result = arrayHasOrderChange(a, b);
            expect(result).toBe(true);
        });

        it("should flag false on no ordering difference", () => {
            const a = [1, 2, 3];
            const b = [1, 2, 3];
            const result = arrayHasOrderChange(a, b);
            expect(result).toBe(false);
        });

        it("should flag true on A length > B length", () => {
            const a = [1, 2, 3, 4];
            const b = [1, 2, 3];
            const result = arrayHasOrderChange(a, b);
            expect(result).toBe(true);
        });

        it("should flag true on A length < B length", () => {
            const a = [1, 2, 3];
            const b = [1, 2, 3, 4];
            const result = arrayHasOrderChange(a, b);
            expect(result).toBe(true);
        });
    });

    describe("arrayHasDiff", () => {
        it("should flag true on A length > B length", () => {
            const a = [1, 2, 3, 4];
            const b = [1, 2, 3];
            const result = arrayHasDiff(a, b);
            expect(result).toBe(true);
        });

        it("should flag true on A length < B length", () => {
            const a = [1, 2, 3];
            const b = [1, 2, 3, 4];
            const result = arrayHasDiff(a, b);
            expect(result).toBe(true);
        });

        it("should flag true on element differences", () => {
            const a = [1, 2, 3];
            const b = [4, 5, 6];
            const result = arrayHasDiff(a, b);
            expect(result).toBe(true);
        });

        it("should flag false if same but order different", () => {
            const a = [1, 2, 3];
            const b = [3, 1, 2];
            const result = arrayHasDiff(a, b);
            expect(result).toBe(false);
        });

        it("should flag false if same", () => {
            const a = [1, 2, 3];
            const b = [1, 2, 3];
            const result = arrayHasDiff(a, b);
            expect(result).toBe(false);
        });
    });

    describe("arrayDiff", () => {
        it("should see added from A->B", () => {
            const a = [1, 2, 3];
            const b = [1, 2, 3, 4];
            const result = arrayDiff(a, b);
            expect(result).toBeDefined();
            expect(result.added).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.added).toHaveLength(1);
            expect(result.removed).toHaveLength(0);
            expect(result.added).toEqual([4]);
        });

        it("should see removed from A->B", () => {
            const a = [1, 2, 3];
            const b = [1, 2];
            const result = arrayDiff(a, b);
            expect(result).toBeDefined();
            expect(result.added).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.added).toHaveLength(0);
            expect(result.removed).toHaveLength(1);
            expect(result.removed).toEqual([3]);
        });

        it("should see added and removed in the same set", () => {
            const a = [1, 2, 3];
            const b = [1, 2, 4]; // note diff
            const result = arrayDiff(a, b);
            expect(result).toBeDefined();
            expect(result.added).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.added).toHaveLength(1);
            expect(result.removed).toHaveLength(1);
            expect(result.added).toEqual([4]);
            expect(result.removed).toEqual([3]);
        });
    });

    describe("arrayIntersection", () => {
        it("should return the intersection", () => {
            const a = [1, 2, 3];
            const b = [1, 2, 4]; // note diff
            const result = arrayIntersection(a, b);
            expect(result).toBeDefined();
            expect(result).toHaveLength(2);
            expect(result).toEqual([1, 2]);
        });

        it("should return an empty array on no matches", () => {
            const a = [1, 2, 3];
            const b = [4, 5, 6];
            const result = arrayIntersection(a, b);
            expect(result).toBeDefined();
            expect(result).toHaveLength(0);
        });
    });

    describe("arrayUnion", () => {
        it("should union 3 arrays with deduplication", () => {
            const a = [1, 2, 3];
            const b = [1, 2, 4, 5]; // note missing 3
            const c = [6, 7, 8, 9];
            const result = arrayUnion(a, b, c);
            expect(result).toBeDefined();
            expect(result).toHaveLength(9);
            expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        });

        it("should deduplicate a single array", () => {
            // dev note: this is technically an edge case, but it is described behaviour if the
            // function is only provided one array (it'll merge the array against itself)
            const a = [1, 1, 2, 2, 3, 3];
            const result = arrayUnion(a);
            expect(result).toBeDefined();
            expect(result).toHaveLength(3);
            expect(result).toEqual([1, 2, 3]);
        });
    });

    describe("ArrayUtil", () => {
        it("should maintain the pointer to the given array", () => {
            const input = [1, 2, 3];
            const result = new ArrayUtil(input);
            expect(result.value).toBe(input);
        });

        it("should group appropriately", () => {
            const input = [
                ["a", 1],
                ["b", 2],
                ["c", 3],
                ["a", 4],
                ["a", 5],
                ["b", 6],
            ];
            const output = {
                a: [
                    ["a", 1],
                    ["a", 4],
                    ["a", 5],
                ],
                b: [
                    ["b", 2],
                    ["b", 6],
                ],
                c: [["c", 3]],
            };
            const result = new ArrayUtil(input).groupBy((p) => p[0]);
            expect(result).toBeDefined();
            expect(result.value).toBeDefined();

            const asObject = Object.fromEntries(result.value.entries());
            expect(asObject).toMatchObject(output);
        });
    });

    describe("GroupedArray", () => {
        it("should maintain the pointer to the given map", () => {
            const input = new Map([
                ["a", [1, 2, 3]],
                ["b", [7, 8, 9]],
                ["c", [4, 5, 6]],
            ]);
            const result = new GroupedArray(input);
            expect(result.value).toBe(input);
        });

        it("should ordering by the provided key order", () => {
            const input = new Map([
                ["a", [1, 2, 3]],
                ["b", [7, 8, 9]], // note counting diff
                ["c", [4, 5, 6]],
            ]);
            const output = [4, 5, 6, 1, 2, 3, 7, 8, 9];
            const keyOrder = ["c", "a", "b"]; // note weird order to cause the `output` to be strange
            const result = new GroupedArray(input).orderBy(keyOrder);
            expect(result).toBeDefined();
            expect(result.value).toBeDefined();
            expect(result.value).toEqual(output);
        });
    });

    describe("concat", () => {
        const emptyArray = () => new Uint8Array(0);
        const array1 = () => new Uint8Array([1, 2, 3]);
        const array2 = () => new Uint8Array([4, 5, 6]);
        const array3 = () => new Uint8Array([7, 8, 9]);

        it("should work for empty arrays", () => {
            expect(concat(emptyArray(), emptyArray())).toEqual(emptyArray());
        });

        it("should concat an empty and non-empty array", () => {
            expect(concat(emptyArray(), array1())).toEqual(array1());
        });

        it("should concat an non-empty and empty array", () => {
            expect(concat(array1(), emptyArray())).toEqual(array1());
        });

        it("should concat two arrays", () => {
            expect(concat(array1(), array2())).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
        });

        it("should concat three arrays", () => {
            expect(concat(array1(), array2(), array3())).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]));
        });
    });

    describe("asyncEvery", () => {
        it("when called with an empty array, it should return true", async () => {
            expect(await asyncEvery([], jest.fn().mockResolvedValue(true))).toBe(true);
        });

        it("when called with some items and the predicate resolves to true for all of them, it should return true", async () => {
            const predicate = jest.fn().mockResolvedValue(true);
            expect(await asyncEvery([1, 2, 3], predicate)).toBe(true);
            expect(predicate).toHaveBeenCalledTimes(3);
            expect(predicate).toHaveBeenCalledWith(1);
            expect(predicate).toHaveBeenCalledWith(2);
            expect(predicate).toHaveBeenCalledWith(3);
        });

        it("when called with some items and the predicate resolves to false for all of them, it should return false", async () => {
            const predicate = jest.fn().mockResolvedValue(false);
            expect(await asyncEvery([1, 2, 3], predicate)).toBe(false);
            expect(predicate).toHaveBeenCalledTimes(1);
            expect(predicate).toHaveBeenCalledWith(1);
        });

        it("when called with some items and the predicate resolves to false for one of them, it should return false", async () => {
            const predicate = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
            expect(await asyncEvery([1, 2, 3], predicate)).toBe(false);
            expect(predicate).toHaveBeenCalledTimes(2);
            expect(predicate).toHaveBeenCalledWith(1);
            expect(predicate).toHaveBeenCalledWith(2);
        });
    });

    describe("asyncSome", () => {
        it("when called with an empty array, it should return false", async () => {
            expect(await asyncSome([], jest.fn().mockResolvedValue(true))).toBe(false);
        });

        it("when called with some items and the predicate resolves to false for all of them, it should return false", async () => {
            const predicate = jest.fn().mockResolvedValue(false);
            expect(await asyncSome([1, 2, 3], predicate)).toBe(false);
            expect(predicate).toHaveBeenCalledTimes(3);
            expect(predicate).toHaveBeenCalledWith(1);
            expect(predicate).toHaveBeenCalledWith(2);
            expect(predicate).toHaveBeenCalledWith(3);
        });

        it("when called with some items and the predicate resolves to true, it should short-circuit and return true", async () => {
            const predicate = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
            expect(await asyncSome([1, 2, 3], predicate)).toBe(true);
            expect(predicate).toHaveBeenCalledTimes(2);
            expect(predicate).toHaveBeenCalledWith(1);
            expect(predicate).toHaveBeenCalledWith(2);
        });
    });
});

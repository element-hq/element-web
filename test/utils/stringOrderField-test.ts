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

import { sortBy } from "lodash";

import {
    ALPHABET,
    averageBetweenStrings,
    baseToString,
    midPointsBetweenStrings,
    reorderLexicographically,
    stringToBase,
} from "../../src/utils/stringOrderField";

const moveLexicographicallyTest = (
    orders: Array<string | undefined>,
    fromIndex: number,
    toIndex: number,
    expectedIndices: number[],
): void => {
    const ops = reorderLexicographically(orders, fromIndex, toIndex);
    expect(ops.map(o => o.index).sort()).toStrictEqual(expectedIndices.sort());

    const zipped: Array<[number, string | undefined]> = orders.map((o, i) => [i, o]);
    ops.forEach(({ index, order }) => {
        zipped[index][1] = order;
    });

    const newOrders = sortBy(zipped, i => i[1]);
    console.log("@@ moveLexicographicallyTest", {orders, zipped, newOrders, fromIndex, toIndex, ops});
    expect(newOrders[toIndex][0]).toBe(fromIndex);
};

describe("stringOrderField", () => {
    it("stringToBase", () => {
        expect(stringToBase(" ")).toBe(0);
        expect(stringToBase("a")).toBe(65);
        expect(stringToBase("aa")).toBe(6240);
        expect(stringToBase("cat")).toBe(610934);
        expect(stringToBase("doggo")).toBe(5607022724);
        expect(stringToBase(" ")).toEqual(0);
        expect(stringToBase("a", "abcdefghijklmnopqrstuvwxyz")).toEqual(0);
        expect(stringToBase("a")).toEqual(65);
        expect(stringToBase("c", "abcdefghijklmnopqrstuvwxyz")).toEqual(2);
        expect(stringToBase("ab")).toEqual(6241);
        expect(stringToBase("cb", "abcdefghijklmnopqrstuvwxyz")).toEqual(53);
        expect(stringToBase("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toEqual(4.5115969857961825e+78);
        expect(stringToBase("~".repeat(50))).toEqual(7.694497527671333e+98);
        // expect(typeof stringToBase("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toEqual("bigint");
    });

    it("baseToString", () => {
        expect(baseToString(10)).toBe(ALPHABET[10]);
        expect(baseToString(10, "abcdefghijklmnopqrstuvwxyz")).toEqual("k");
        expect(baseToString(6241)).toEqual("ab");
        expect(baseToString(53, "abcdefghijklmnopqrstuvwxyz")).toEqual("cb");
        expect(baseToString(1234)).toBe(",~");
    });

    it("averageBetweenStrings", () => {
        [
            { a: "a", b: "z", output: `m` },
            { a: "ba", b: "z", output: `n@` },
            { a: "z", b: "ba", output: `n@` },
            { a: "#    ", b: "$8888", output: `#[[[[` },
            { a: "cat", b: "doggo", output: `d9>Cw` },
            { a: "cat", b: "doggo", output: "cumqh", alphabet: "abcdefghijklmnopqrstuvwxyz" },
            { a: "aa", b: "zz", output: "mz", alphabet: "abcdefghijklmnopqrstuvwxyz" },
            { a: "a", b: "z", output: "m", alphabet: "abcdefghijklmnopqrstuvwxyz" },
            { a: "AA", b: "zz", output: "^." },
            { a: "A", b: "z", output: "]" },
            {
                a: "A".repeat(50),
                b: "Z".repeat(50),
                output: "M}M}M}N ba`54Qpt\\\\Z+kNA#O(9}z>@2jJm]%Y^$m<8lRzz/2[Y",
            },
        ].forEach((c) => {
            // assert that the output string falls lexicographically between `a` and `b`
            expect([c.a, c.b, c.output].sort()[1]).toBe(c.output);
            expect(averageBetweenStrings(c.a, c.b, c.alphabet)).toBe(c.output);
        });

        expect(averageBetweenStrings("Q#!x+k", "V6yr>L")).toBe("S\\Mu5,");
    });

    it("midPointsBetweenStrings", () => {
        expect(midPointsBetweenStrings("a", "e", 3)).toStrictEqual(["b", "c", "d"]);
        expect(midPointsBetweenStrings("a", "e", 0)).toStrictEqual([]);
        expect(midPointsBetweenStrings("a", "e", 4)).toStrictEqual([]);
    });

    it("moveLexicographically left", () => {
        moveLexicographicallyTest(["a", "c", "e", "g", "i"], 2, 1, [2]);
    });

    it("moveLexicographically right", () => {
        moveLexicographicallyTest(["a", "c", "e", "g", "i"], 1, 2, [1]);
    });

    it("moveLexicographically all undefined", () => {
        moveLexicographicallyTest(
            [undefined, undefined, undefined, undefined, undefined, undefined],
            4,
            1,
            [0, 4],
        );
    });

    it("moveLexicographically all undefined to end", () => {
        moveLexicographicallyTest(
            [undefined, undefined, undefined, undefined, undefined, undefined],
            1,
            4,
            [0, 1, 2, 3, 4],
        );
    });

    it("moveLexicographically some undefined move left", () => {
        moveLexicographicallyTest(
            ["a", "c", "e", undefined, undefined, undefined],
            5,
            2,
            [5],
        );
    });

    it("moveLexicographically some undefined move left close", () => {
        moveLexicographicallyTest(
            ["a", "a", "e", undefined, undefined, undefined],
            5,
            1,
            [1, 5],
        );
    });
});


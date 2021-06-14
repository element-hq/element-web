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
    baseToString,
    midPointsBetweenStrings,
    reorderLexicographically,
    stringToBase,
} from "../../src/utils/stringOrderField";

const moveLexicographicallyTest = (
    orders: Array<string | undefined>,
    fromIndex: number,
    toIndex: number,
    expectedChanges: number,
    maxLength?: number,
): void => {
    const ops = reorderLexicographically(orders, fromIndex, toIndex, maxLength);

    const zipped: Array<[number, string | undefined]> = orders.map((o, i) => [i, o]);
    ops.forEach(({ index, order }) => {
        zipped[index][1] = order;
    });

    const newOrders = sortBy(zipped, i => i[1]);
    console.log("@@ moveLexicographicallyTest", {orders, zipped, newOrders, fromIndex, toIndex, ops});
    expect(newOrders[toIndex][0]).toBe(fromIndex);
    expect(ops).toHaveLength(expectedChanges);
};

describe("stringOrderField", () => {
    it("stringToBase", () => {
        expect(Number(stringToBase(" "))).toBe(0);
        expect(Number(stringToBase("a"))).toBe(65);
        expect(Number(stringToBase("aa"))).toBe(6240);
        expect(Number(stringToBase("cat"))).toBe(610934);
        expect(Number(stringToBase("doggo"))).toBe(5607022724);
        expect(Number(stringToBase(" "))).toEqual(0);
        expect(Number(stringToBase("a", "abcdefghijklmnopqrstuvwxyz"))).toEqual(0);
        expect(Number(stringToBase("a"))).toEqual(65);
        expect(Number(stringToBase("c", "abcdefghijklmnopqrstuvwxyz"))).toEqual(2);
        expect(Number(stringToBase("ab"))).toEqual(6241);
        expect(Number(stringToBase("cb", "abcdefghijklmnopqrstuvwxyz"))).toEqual(53);
        expect(Number(stringToBase("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"))).toEqual(4.511596985796182e+78);
        expect(Number(stringToBase("~".repeat(50)))).toEqual(7.694497527671333e+98);
        // expect(typeof stringToBase("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toEqual("bigint");
    });

    it("baseToString", () => {
        expect(baseToString(BigInt(10))).toBe(ALPHABET[10]);
        expect(baseToString(BigInt(10), "abcdefghijklmnopqrstuvwxyz")).toEqual("k");
        expect(baseToString(BigInt(6241))).toEqual("ab");
        expect(baseToString(BigInt(53), "abcdefghijklmnopqrstuvwxyz")).toEqual("cb");
        expect(baseToString(BigInt(1234))).toBe(",~");
    });

    it("midPointsBetweenStrings", () => {
        const midpoints = ["a", ...midPointsBetweenStrings("a", "e", 3, 1), "e"].sort();
        expect(midpoints[0]).toBe("a");
        expect(midpoints[4]).toBe("e");
        expect(midPointsBetweenStrings("a", "e", 0, 1)).toStrictEqual([]);
        expect(midPointsBetweenStrings("a", "e", 4, 1)).toStrictEqual([]);
    });

    it("moveLexicographically left", () => {
        moveLexicographicallyTest(["a", "c", "e", "g", "i"], 2, 1, 1);
    });

    it("moveLexicographically right", () => {
        moveLexicographicallyTest(["a", "c", "e", "g", "i"], 1, 2, 1);
    });

    it("moveLexicographically all undefined", () => {
        moveLexicographicallyTest(
            [undefined, undefined, undefined, undefined, undefined, undefined],
            4,
            1,
            2,
        );
    });

    it("moveLexicographically all undefined to end", () => {
        moveLexicographicallyTest(
            [undefined, undefined, undefined, undefined, undefined, undefined],
            1,
            4,
            5,
        );
    });

    it("moveLexicographically some undefined move left", () => {
        moveLexicographicallyTest(
            ["a", "c", "e", undefined, undefined, undefined],
            5,
            2,
            1,
        );
    });

    it("moveLexicographically some undefined move left close", () => {
        moveLexicographicallyTest(
            ["a", "a", "e", undefined, undefined, undefined],
            5,
            1,
            2,
        );
    });

    it("test moving to the start when all is undefined", () => {
        moveLexicographicallyTest(
            [undefined, undefined, undefined, undefined],
            2,
            0,
            1,
        );
    });

    it("test moving to the end when all is undefined", () => {
        moveLexicographicallyTest(
            [undefined, undefined, undefined, undefined],
            1,
            3,
            4,
        );
    });

    it("test moving left when all is undefined", () => {
        moveLexicographicallyTest(
            [undefined, undefined, undefined, undefined, undefined, undefined],
            4,
            1,
            2,
        );
    });

    it("test moving right when all is undefined", () => {
        moveLexicographicallyTest(
            [undefined, undefined, undefined, undefined],
            1,
            2,
            3,
        );
    });

    it("test moving more right when all is undefined", () => {
        moveLexicographicallyTest(
            [undefined, undefined, undefined, undefined, undefined, /**/ undefined, undefined],
            1,
            4,
            5,
        );
    });

    it("test moving left when right is undefined", () => {
        moveLexicographicallyTest(
            ["20", undefined, undefined, undefined, undefined, undefined],
            4,
            2,
            2,
        );
    });

    it("test moving right when right is undefined", () => {
        moveLexicographicallyTest(
            ["50", undefined, undefined, undefined, undefined, /**/ undefined, undefined],
            1,
            4,
            4,
        );
    });

    it("test moving left when right is defined", () => {
        moveLexicographicallyTest(
            ["10", "20", "30", "40", undefined, undefined],
            3,
            1,
            1,
        );
    });

    it("test moving right when right is defined", () => {
        moveLexicographicallyTest(
            ["10", "20", "30", "40", "50", undefined],
            1,
            3,
            1,
        );
    });

    it("test moving left when all is defined", () => {
        moveLexicographicallyTest(
            ["11", "13", "15", "17", "19"],
            2,
            1,
            1,
        );
    });

    it("test moving right when all is defined", () => {
        moveLexicographicallyTest(
            ["11", "13", "15", "17", "19"],
            1,
            2,
            1,
        );
    });

    it.skip("test moving left into no left space", () => {
        moveLexicographicallyTest(
            ["11", "12", "13", "14", "19"],
            3,
            1,
            2,
            2,
        );
    });

    it("test moving right into no right space", () => {
        moveLexicographicallyTest(
            ["15", "16", "17", "18", "19"],
            1,
            3,
            3,
            2,
        );
    });

    it("test moving right into no left space", () => {
        moveLexicographicallyTest(
            ["11", "12", "13", "14", "15", "16", undefined],
            1,
            3,
            3,
        );
    });

    it("test moving left into no right space", () => {
        moveLexicographicallyTest(
            ["15", "16", "17", "18", "19"],
            4,
            3,
            4,
            2,
        );
    });

    it("test moving left into no left space", () => {
        moveLexicographicallyTest(
            [
                ALPHABET.charAt(0),
                ALPHABET.charAt(1),
                ALPHABET.charAt(2),
                ALPHABET.charAt(3),
                ALPHABET.charAt(4),
                ALPHABET.charAt(5),
            ],
            5,
            1,
            5,
            1,
        );
    });

    it("test moving right into no right space", () => {
        moveLexicographicallyTest(
            [
                ALPHABET.charAt(ALPHABET.length - 5),
                ALPHABET.charAt(ALPHABET.length - 4),
                ALPHABET.charAt(ALPHABET.length - 3),
                ALPHABET.charAt(ALPHABET.length - 2),
                ALPHABET.charAt(ALPHABET.length - 1),
            ],
            1,
            3,
            3,
            1,
        );
    });

    it("test moving right into no left space", () => {
        moveLexicographicallyTest(
            ["0", "1", "2", "3", "4", "5"],
            1,
            3,
            3,
            1,
        );
    });

    it("test moving left into no right space", () => {
        moveLexicographicallyTest(
            [
                ALPHABET.charAt(ALPHABET.length - 5),
                ALPHABET.charAt(ALPHABET.length - 4),
                ALPHABET.charAt(ALPHABET.length - 3),
                ALPHABET.charAt(ALPHABET.length - 2),
                ALPHABET.charAt(ALPHABET.length - 1),
            ],
            4,
            3,
            4,
            1,
        );
    });

    const prev = (str: string) => baseToString(stringToBase(str) - BigInt(1));
    const next = (str: string) => baseToString(stringToBase(str) + BigInt(1));

    it("baseN calculation is correctly consecutive", () => {
        const str = "this-is-a-test";
        expect(next(prev(str))).toBe(str);
    });

    it("rolls over sanely", () => {
        const maxSpaceValue = "~".repeat(50);
        const fiftyFirstChar = "!" + " ".repeat(50);
        expect(next(maxSpaceValue)).toBe(fiftyFirstChar);
        expect(prev(fiftyFirstChar)).toBe(maxSpaceValue);
        expect(stringToBase(ALPHABET[0])).toEqual(BigInt(0));
        expect(stringToBase(ALPHABET[1])).toEqual(BigInt(1));
        expect(ALPHABET[ALPHABET.length - 1]).toBe("~");
        expect(ALPHABET[0]).toBe(" ");
    });
});


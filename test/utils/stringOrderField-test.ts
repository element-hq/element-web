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
import { stringToBase, baseToString, averageBetweenStrings } from "matrix-js-sdk/src/utils";

import {
    ALPHABET,
    midPointsBetweenStrings,
    reorderLexicographically,
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
    expect(newOrders[toIndex][0]).toBe(fromIndex);
    expect(ops).toHaveLength(expectedChanges);
};

describe("stringOrderField", () => {
    it("stringToBase", () => {
        expect(Number(stringToBase(""))).toBe(0);
        expect(Number(stringToBase(" "))).toBe(1);
        expect(Number(stringToBase("a"))).toBe(66);
        expect(Number(stringToBase(" !"))).toBe(97);
        expect(Number(stringToBase("aa"))).toBe(6336);
        expect(Number(stringToBase("cat"))).toBe(620055);
        expect(Number(stringToBase("doggo"))).toBe(5689339845);
        expect(Number(stringToBase("a", "abcdefghijklmnopqrstuvwxyz"))).toEqual(1);
        expect(Number(stringToBase("a"))).toEqual(66);
        expect(Number(stringToBase("c", "abcdefghijklmnopqrstuvwxyz"))).toEqual(3);
        expect(Number(stringToBase("ab"))).toEqual(6337);
        expect(Number(stringToBase("cb", "abcdefghijklmnopqrstuvwxyz"))).toEqual(80);
        expect(Number(stringToBase("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"))).toEqual(4.648312045971824e+78);
        expect(Number(stringToBase("~".repeat(50)))).toEqual(7.776353884348688e+98);
        expect(Number(stringToBase("      "))).toEqual(7820126496);
        expect(Number(stringToBase("  "))).toEqual(96);
        expect(Number(stringToBase(" !"))).toEqual(97);
        expect(Number(stringToBase("S:J\\~"))).toEqual(4258975590);
        expect(Number(stringToBase("!'Tu:}"))).toEqual(16173443434);
    });

    it("baseToString", () => {
        expect(baseToString(BigInt(10))).toBe(ALPHABET[9]);
        expect(baseToString(BigInt(10), "abcdefghijklmnopqrstuvwxyz")).toEqual("j");
        expect(baseToString(BigInt(6241))).toEqual("`a");
        expect(baseToString(BigInt(53), "abcdefghijklmnopqrstuvwxyz")).toEqual("ba");
        expect(baseToString(BigInt(1234))).toBe("+}");
        expect(baseToString(BigInt(0))).toBe(""); // TODO
        expect(baseToString(BigInt(1))).toBe(" ");
        expect(baseToString(BigInt(95))).toBe("~");
        expect(baseToString(BigInt(96))).toBe("  ");
        expect(baseToString(BigInt(97))).toBe(" !");
        expect(baseToString(BigInt(98))).toBe(' "');
        expect(baseToString(BigInt(1))).toBe(" ");
    });

    it("midPointsBetweenStrings", () => {
        expect(averageBetweenStrings("!!", "##")).toBe('""');
        const midpoints = ["a", ...midPointsBetweenStrings("a", "e", 3, 1), "e"].sort();
        expect(midpoints[0]).toBe("a");
        expect(midpoints[4]).toBe("e");
        expect(midPointsBetweenStrings("a", "e", 0, 1)).toStrictEqual([]);
        expect(midPointsBetweenStrings("a", "e", 4, 1)).toStrictEqual([]);
        expect(midPointsBetweenStrings("      ", "!'Tu:}", 1, 50)).toStrictEqual([" S:J\\~"]);
        expect(averageBetweenStrings("  ", "!!")).toBe(" P");
        expect(averageBetweenStrings("! ", "!!")).toBe("!  ");
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

    it("test moving left into no left space", () => {
        moveLexicographicallyTest(
            ["11", "12", "13", "14", "19"],
            3,
            1,
            2,
            2,
        );

        moveLexicographicallyTest(
            [
                ALPHABET.charAt(0),
                // Target
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
            ["15", "16", "17", "18", "19"],
            1,
            3,
            3,
            2,
        );

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
            ["11", "12", "13", "14", "15", "16", undefined],
            1,
            3,
            3,
        );

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
            ["15", "16", "17", "18", "19"],
            4,
            3,
            4,
            2,
        );

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
        const fiftyFirstChar = " ".repeat(51);
        expect(next(maxSpaceValue)).toBe(fiftyFirstChar);
        expect(prev(fiftyFirstChar)).toBe(maxSpaceValue);
        expect(Number(stringToBase(ALPHABET[0]))).toEqual(1);
        expect(Number(stringToBase(ALPHABET[1]))).toEqual(2);
        expect(ALPHABET[ALPHABET.length - 1]).toBe("~");
        expect(ALPHABET[0]).toBe(" ");
    });
});


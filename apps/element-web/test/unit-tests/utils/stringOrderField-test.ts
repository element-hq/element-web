/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { sortBy } from "lodash";
import { averageBetweenStrings, DEFAULT_ALPHABET } from "matrix-js-sdk/src/utils";

import { midPointsBetweenStrings, reorderLexicographically } from "../../../src/utils/stringOrderField";

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

    const newOrders = sortBy(zipped, (i) => i[1]);
    expect(newOrders[toIndex][0]).toBe(fromIndex);
    expect(ops).toHaveLength(expectedChanges);
};

describe("stringOrderField", () => {
    describe("midPointsBetweenStrings", () => {
        it("should work", () => {
            expect(averageBetweenStrings("!!", "##")).toBe('""');
            const midpoints = ["a", ...midPointsBetweenStrings("a", "e", 3, 1), "e"].sort();
            expect(midpoints[0]).toBe("a");
            expect(midpoints[4]).toBe("e");
            expect(midPointsBetweenStrings("      ", "!'Tu:}", 1, 50)).toStrictEqual([" S:J\\~"]);
        });

        it("should return empty array when the request is not possible", () => {
            expect(midPointsBetweenStrings("a", "e", 0, 1)).toStrictEqual([]);
            expect(midPointsBetweenStrings("a", "e", 4, 1)).toStrictEqual([]);
        });
    });

    describe("reorderLexicographically", () => {
        it("should work when moving left", () => {
            moveLexicographicallyTest(["a", "c", "e", "g", "i"], 2, 1, 1);
        });

        it("should work when moving right", () => {
            moveLexicographicallyTest(["a", "c", "e", "g", "i"], 1, 2, 1);
        });

        it("should work when all orders are undefined", () => {
            moveLexicographicallyTest([undefined, undefined, undefined, undefined, undefined, undefined], 4, 1, 2);
        });

        it("should work when moving to end and all orders are undefined", () => {
            moveLexicographicallyTest([undefined, undefined, undefined, undefined, undefined, undefined], 1, 4, 5);
        });

        it("should work when moving left and some orders are undefined", () => {
            moveLexicographicallyTest(["a", "c", "e", undefined, undefined, undefined], 5, 2, 1);

            moveLexicographicallyTest(["a", "a", "e", undefined, undefined, undefined], 5, 1, 2);
        });

        it("should work moving to the start when all is undefined", () => {
            moveLexicographicallyTest([undefined, undefined, undefined, undefined], 2, 0, 1);
        });

        it("should work moving to the end when all is undefined", () => {
            moveLexicographicallyTest([undefined, undefined, undefined, undefined], 1, 3, 4);
        });

        it("should work moving left when all is undefined", () => {
            moveLexicographicallyTest([undefined, undefined, undefined, undefined, undefined, undefined], 4, 1, 2);
        });

        it("should work moving right when all is undefined", () => {
            moveLexicographicallyTest([undefined, undefined, undefined, undefined], 1, 2, 3);
        });

        it("should work moving more right when all is undefined", () => {
            moveLexicographicallyTest(
                [undefined, undefined, undefined, undefined, undefined, /**/ undefined, undefined],
                1,
                4,
                5,
            );
        });

        it("should work moving left when right is undefined", () => {
            moveLexicographicallyTest(["20", undefined, undefined, undefined, undefined, undefined], 4, 2, 2);
        });

        it("should work moving right when right is undefined", () => {
            moveLexicographicallyTest(
                ["50", undefined, undefined, undefined, undefined, /**/ undefined, undefined],
                1,
                4,
                4,
            );
        });

        it("should work moving left when right is defined", () => {
            moveLexicographicallyTest(["10", "20", "30", "40", undefined, undefined], 3, 1, 1);
        });

        it("should work moving right when right is defined", () => {
            moveLexicographicallyTest(["10", "20", "30", "40", "50", undefined], 1, 3, 1);
        });

        it("should work moving left when all is defined", () => {
            moveLexicographicallyTest(["11", "13", "15", "17", "19"], 2, 1, 1);
        });

        it("should work moving right when all is defined", () => {
            moveLexicographicallyTest(["11", "13", "15", "17", "19"], 1, 2, 1);
        });

        it("should work moving left into no left space", () => {
            moveLexicographicallyTest(["11", "12", "13", "14", "19"], 3, 1, 2, 2);

            moveLexicographicallyTest(
                [
                    DEFAULT_ALPHABET.charAt(0),
                    // Target
                    DEFAULT_ALPHABET.charAt(1),
                    DEFAULT_ALPHABET.charAt(2),
                    DEFAULT_ALPHABET.charAt(3),
                    DEFAULT_ALPHABET.charAt(4),
                    DEFAULT_ALPHABET.charAt(5),
                ],
                5,
                1,
                5,
                1,
            );
        });

        it("should work moving right into no right space", () => {
            moveLexicographicallyTest(["15", "16", "17", "18", "19"], 1, 3, 3, 2);

            moveLexicographicallyTest(
                [
                    DEFAULT_ALPHABET.charAt(DEFAULT_ALPHABET.length - 5),
                    DEFAULT_ALPHABET.charAt(DEFAULT_ALPHABET.length - 4),
                    DEFAULT_ALPHABET.charAt(DEFAULT_ALPHABET.length - 3),
                    DEFAULT_ALPHABET.charAt(DEFAULT_ALPHABET.length - 2),
                    DEFAULT_ALPHABET.charAt(DEFAULT_ALPHABET.length - 1),
                ],
                1,
                3,
                3,
                1,
            );
        });

        it("should work moving right into no left space", () => {
            moveLexicographicallyTest(["11", "12", "13", "14", "15", "16", undefined], 1, 3, 3);

            moveLexicographicallyTest(["0", "1", "2", "3", "4", "5"], 1, 3, 3, 1);
        });

        it("should work moving left into no right space", () => {
            moveLexicographicallyTest(["15", "16", "17", "18", "19"], 4, 3, 4, 2);

            moveLexicographicallyTest(
                [
                    DEFAULT_ALPHABET.charAt(DEFAULT_ALPHABET.length - 5),
                    DEFAULT_ALPHABET.charAt(DEFAULT_ALPHABET.length - 4),
                    DEFAULT_ALPHABET.charAt(DEFAULT_ALPHABET.length - 3),
                    DEFAULT_ALPHABET.charAt(DEFAULT_ALPHABET.length - 2),
                    DEFAULT_ALPHABET.charAt(DEFAULT_ALPHABET.length - 1),
                ],
                4,
                3,
                4,
                1,
            );
        });
    });
});

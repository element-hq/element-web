/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import * as utils from "../../src/utils";
import {
    alphabetPad,
    averageBetweenStrings,
    baseToString,
    deepSortedObjectEntries,
    DEFAULT_ALPHABET,
    lexicographicCompare,
    nextString,
    prevString,
    recursiveMapToObject,
    simpleRetryOperation,
    stringToBase,
    sortEventsByLatestContentTimestamp,
    safeSet,
    MapWithDefault,
    globToRegexp,
    escapeRegExp,
} from "../../src/utils";
import { logger } from "../../src/logger";
import { mkMessage } from "../test-utils/test-utils";
import { makeBeaconEvent } from "../test-utils/beacon";
import { ReceiptType } from "../../src/@types/read_receipts";

// TODO: Fix types throughout

describe("utils", function () {
    describe("encodeParams", function () {
        it("should url encode and concat with &s", function () {
            const params = {
                foo: "bar",
                baz: "beer@",
            };
            expect(utils.encodeParams(params).toString()).toEqual("foo=bar&baz=beer%40");
        });

        it("should handle boolean and numeric values", function () {
            const params = {
                string: "foobar",
                number: 12345,
                boolean: false,
            };
            expect(utils.encodeParams(params).toString()).toEqual("string=foobar&number=12345&boolean=false");
        });

        it("should handle string arrays", () => {
            const params = {
                via: ["one", "two", "three"],
            };
            expect(utils.encodeParams(params).toString()).toEqual("via=one&via=two&via=three");
        });
    });

    describe("decodeParams", () => {
        it("should be able to decode multiple values into an array", () => {
            const params = "foo=bar&via=a&via=b&via=c";
            expect(utils.decodeParams(params)).toEqual({
                foo: "bar",
                via: ["a", "b", "c"],
            });
        });
    });

    describe("encodeUri", function () {
        it("should replace based on object keys and url encode", function () {
            const path = "foo/bar/%something/%here";
            const vals = {
                "%something": "baz",
                "%here": "beer@",
            };
            expect(utils.encodeUri(path, vals)).toEqual("foo/bar/baz/beer%40");
        });
    });

    describe("removeElement", function () {
        it("should remove only 1 element if there is a match", function () {
            const matchFn = function () {
                return true;
            };
            const arr = [55, 66, 77];
            utils.removeElement(arr, matchFn);
            expect(arr).toEqual([66, 77]);
        });
        it("should be able to remove in reverse order", function () {
            const matchFn = function () {
                return true;
            };
            const arr = [55, 66, 77];
            utils.removeElement(arr, matchFn, true);
            expect(arr).toEqual([55, 66]);
        });
        it("should remove nothing if the function never returns true", function () {
            const matchFn = function () {
                return false;
            };
            const arr = [55, 66, 77];
            utils.removeElement(arr, matchFn);
            expect(arr).toEqual(arr);
        });
    });

    describe("isFunction", function () {
        it("should return true for functions", function () {
            expect(utils.isFunction([])).toBe(false);
            expect(utils.isFunction([5, 3, 7])).toBe(false);
            expect(utils.isFunction(undefined)).toBe(false);
            expect(utils.isFunction(null)).toBe(false);
            expect(utils.isFunction({})).toBe(false);
            expect(utils.isFunction("foo")).toBe(false);
            expect(utils.isFunction(555)).toBe(false);

            expect(utils.isFunction(function () {})).toBe(true);
            const s = { foo: function () {} };
            expect(utils.isFunction(s.foo)).toBe(true);
        });
    });

    describe("checkObjectHasKeys", function () {
        it("should throw for missing keys", function () {
            expect(function () {
                utils.checkObjectHasKeys({}, ["foo"]);
            }).toThrow();
            expect(function () {
                utils.checkObjectHasKeys(
                    {
                        foo: "bar",
                    },
                    ["foo"],
                );
            }).not.toThrow();
        });
    });

    describe("deepCompare", function () {
        const assert = {
            isTrue: function (x: any) {
                // eslint-disable-next-line jest/no-standalone-expect
                expect(x).toBe(true);
            },
            isFalse: function (x: any) {
                // eslint-disable-next-line jest/no-standalone-expect
                expect(x).toBe(false);
            },
        };

        it("should handle primitives", function () {
            assert.isTrue(utils.deepCompare(null, null));
            assert.isFalse(utils.deepCompare(null, undefined));
            assert.isTrue(utils.deepCompare("hi", "hi"));
            assert.isTrue(utils.deepCompare(5, 5));
            assert.isFalse(utils.deepCompare(5, 10));
        });

        it("should handle regexps", function () {
            assert.isTrue(utils.deepCompare(/abc/, /abc/));
            assert.isFalse(utils.deepCompare(/abc/, /123/));
            const r = /abc/;
            assert.isTrue(utils.deepCompare(r, r));
        });

        it("should handle dates", function () {
            assert.isTrue(utils.deepCompare(new Date("2011-03-31"), new Date("2011-03-31")));
            assert.isFalse(utils.deepCompare(new Date("2011-03-31"), new Date("1970-01-01")));
        });

        it("should handle arrays", function () {
            assert.isTrue(utils.deepCompare([], []));
            assert.isTrue(utils.deepCompare([1, 2], [1, 2]));
            assert.isFalse(utils.deepCompare([1, 2], [2, 1]));
            assert.isFalse(utils.deepCompare([1, 2], [1, 2, 3]));
        });

        it("should handle simple objects", function () {
            assert.isTrue(utils.deepCompare({}, {}));
            assert.isTrue(utils.deepCompare({ a: 1, b: 2 }, { a: 1, b: 2 }));
            assert.isTrue(utils.deepCompare({ a: 1, b: 2 }, { b: 2, a: 1 }));
            assert.isFalse(utils.deepCompare({ a: 1, b: 2 }, { a: 1, b: 3 }));
            assert.isFalse(utils.deepCompare({ a: 1, b: 2 }, { a: 1 }));
            assert.isFalse(utils.deepCompare({ a: 1 }, { a: 1, b: 2 }));
            assert.isFalse(utils.deepCompare({ a: 1 }, { b: 1 }));

            assert.isTrue(
                utils.deepCompare(
                    {
                        1: { name: "mhc", age: 28 },
                        2: { name: "arb", age: 26 },
                    },
                    {
                        1: { name: "mhc", age: 28 },
                        2: { name: "arb", age: 26 },
                    },
                ),
            );

            assert.isFalse(
                utils.deepCompare(
                    {
                        1: { name: "mhc", age: 28 },
                        2: { name: "arb", age: 26 },
                    },
                    {
                        1: { name: "mhc", age: 28 },
                        2: { name: "arb", age: 27 },
                    },
                ),
            );

            assert.isFalse(utils.deepCompare({}, null));
            assert.isFalse(utils.deepCompare({}, undefined));
        });

        it("should handle functions", function () {
            // no two different function is equal really, they capture their
            // context variables so even if they have same toString(), they
            // won't have same functionality
            const func = function () {
                return true;
            };
            const func2 = function () {
                return true;
            };
            assert.isTrue(utils.deepCompare(func, func));
            assert.isFalse(utils.deepCompare(func, func2));
            assert.isTrue(utils.deepCompare({ a: { b: func } }, { a: { b: func } }));
            assert.isFalse(utils.deepCompare({ a: { b: func } }, { a: { b: func2 } }));
        });
    });

    describe("chunkPromises", function () {
        it("should execute promises in chunks", async function () {
            let promiseCount = 0;

            async function fn1() {
                await utils.sleep(1);
                expect(promiseCount).toEqual(0);
                ++promiseCount;
            }

            async function fn2() {
                expect(promiseCount).toEqual(1);
                ++promiseCount;
            }

            await utils.chunkPromises([fn1, fn2], 1);
            expect(promiseCount).toEqual(2);
        });
    });

    describe("simpleRetryOperation", () => {
        it("should retry", async () => {
            let count = 0;
            const val = {};
            const fn = (attempt: any) => {
                count++;

                // If this expectation fails then it can appear as a Jest Timeout due to
                // the retry running beyond the test limit.
                expect(attempt).toEqual(count);

                if (count > 1) {
                    return Promise.resolve(val);
                } else {
                    return Promise.reject(new Error("Iterative failure"));
                }
            };

            const ret = await simpleRetryOperation(fn);
            expect(ret).toBe(val);
            expect(count).toEqual(2);
        });

        // We don't test much else of the function because then we're just testing that the
        // underlying library behaves, which should be tested on its own. Our API surface is
        // all that concerns us.
    });

    describe("DEFAULT_ALPHABET", () => {
        it("should be usefully printable ASCII in order", () => {
            expect(DEFAULT_ALPHABET).toEqual(
                " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~",
            );
        });
    });

    describe("alphabetPad", () => {
        it("should pad to the alphabet length", () => {
            const len = 12;
            expect(alphabetPad("a", len)).toEqual("a" + "".padEnd(len - 1, DEFAULT_ALPHABET[0]));
            expect(alphabetPad("a", len, "123")).toEqual("a" + "".padEnd(len - 1, "1"));
        });
    });

    describe("baseToString", () => {
        it("should calculate the appropriate string from numbers", () => {
            // Verify the whole alphabet
            for (let i = BigInt(1); i <= DEFAULT_ALPHABET.length; i++) {
                logger.log({ i }); // for debugging
                expect(baseToString(i)).toEqual(DEFAULT_ALPHABET[Number(i) - 1]);
            }

            // Just quickly double check that repeated characters aren't treated as padding, particularly
            // at the beginning of the alphabet where they are most vulnerable to this behaviour.
            expect(baseToString(BigInt(1))).toEqual(DEFAULT_ALPHABET[0].repeat(1));
            expect(baseToString(BigInt(96))).toEqual(DEFAULT_ALPHABET[0].repeat(2));
            expect(baseToString(BigInt(9121))).toEqual(DEFAULT_ALPHABET[0].repeat(3));
            expect(baseToString(BigInt(866496))).toEqual(DEFAULT_ALPHABET[0].repeat(4));
            expect(baseToString(BigInt(82317121))).toEqual(DEFAULT_ALPHABET[0].repeat(5));
            expect(baseToString(BigInt(7820126496))).toEqual(DEFAULT_ALPHABET[0].repeat(6));

            expect(baseToString(BigInt(10))).toEqual(DEFAULT_ALPHABET[9]);
            expect(baseToString(BigInt(10), "abcdefghijklmnopqrstuvwxyz")).toEqual("j");
            expect(baseToString(BigInt(6337))).toEqual("ab");
            expect(baseToString(BigInt(80), "abcdefghijklmnopqrstuvwxyz")).toEqual("cb");
        });
    });

    describe("stringToBase", () => {
        it("should calculate the appropriate number for a string", () => {
            expect(stringToBase(DEFAULT_ALPHABET[0].repeat(1))).toEqual(BigInt(1));
            expect(stringToBase(DEFAULT_ALPHABET[0].repeat(2))).toEqual(BigInt(96));
            expect(stringToBase(DEFAULT_ALPHABET[0].repeat(3))).toEqual(BigInt(9121));
            expect(stringToBase(DEFAULT_ALPHABET[0].repeat(4))).toEqual(BigInt(866496));
            expect(stringToBase(DEFAULT_ALPHABET[0].repeat(5))).toEqual(BigInt(82317121));
            expect(stringToBase(DEFAULT_ALPHABET[0].repeat(6))).toEqual(BigInt(7820126496));
            expect(stringToBase("a", "abcdefghijklmnopqrstuvwxyz")).toEqual(BigInt(1));
            expect(stringToBase("a")).toEqual(BigInt(66));
            expect(stringToBase("c", "abcdefghijklmnopqrstuvwxyz")).toEqual(BigInt(3));
            expect(stringToBase("ab")).toEqual(BigInt(6337));
            expect(stringToBase("cb", "abcdefghijklmnopqrstuvwxyz")).toEqual(BigInt(80));
        });
    });

    describe("averageBetweenStrings", () => {
        it("should average appropriately", () => {
            expect(averageBetweenStrings("  ", "!!")).toEqual(" P");
            expect(averageBetweenStrings(" ", "!")).toEqual("  ");
            expect(averageBetweenStrings("A", "B")).toEqual("A ");
            expect(averageBetweenStrings("AA", "BB")).toEqual("Aq");
            expect(averageBetweenStrings("A", "z")).toEqual("]");
            expect(averageBetweenStrings("a", "z", "abcdefghijklmnopqrstuvwxyz")).toEqual("m");
            expect(averageBetweenStrings("AA", "zz")).toEqual("^.");
            expect(averageBetweenStrings("aa", "zz", "abcdefghijklmnopqrstuvwxyz")).toEqual("mz");
            expect(averageBetweenStrings("cat", "doggo")).toEqual("d9>Cw");
            expect(averageBetweenStrings("cat", "doggo", "abcdefghijklmnopqrstuvwxyz")).toEqual("cumqh");
        });
    });

    describe("nextString", () => {
        it("should find the next string appropriately", () => {
            expect(nextString("A")).toEqual("B");
            expect(nextString("b", "abcdefghijklmnopqrstuvwxyz")).toEqual("c");
            expect(nextString("cat")).toEqual("cau");
            expect(nextString("cat", "abcdefghijklmnopqrstuvwxyz")).toEqual("cau");
        });
    });

    describe("prevString", () => {
        it("should find the next string appropriately", () => {
            expect(prevString("B")).toEqual("A");
            expect(prevString("c", "abcdefghijklmnopqrstuvwxyz")).toEqual("b");
            expect(prevString("cau")).toEqual("cat");
            expect(prevString("cau", "abcdefghijklmnopqrstuvwxyz")).toEqual("cat");
        });
    });

    // Let's just ensure the ordering is sensible for lexicographic ordering
    describe("string averaging unified", () => {
        it("should be truly previous and next", () => {
            let midpoint = "cat";

            // We run this test 100 times to ensure we end up with a sane sequence.
            for (let i = 0; i < 100; i++) {
                const next = nextString(midpoint);
                const prev = prevString(midpoint);
                logger.log({ i, midpoint, next, prev }); // for test debugging

                expect(lexicographicCompare(midpoint, next) < 0).toBe(true);
                expect(lexicographicCompare(midpoint, prev) > 0).toBe(true);
                expect(averageBetweenStrings(prev, next)).toBe(midpoint);

                midpoint = next;
            }
        });

        it("should roll over", () => {
            const lastAlpha = DEFAULT_ALPHABET[DEFAULT_ALPHABET.length - 1];
            const firstAlpha = DEFAULT_ALPHABET[0];

            const highRoll = firstAlpha + firstAlpha;
            const lowRoll = lastAlpha;

            expect(nextString(lowRoll)).toEqual(highRoll);
            expect(prevString(highRoll)).toEqual(lowRoll);
        });

        it("should be reversible on small strings", () => {
            // Large scale reversibility is tested for max space order value
            const input = "cats";
            expect(prevString(nextString(input))).toEqual(input);
        });

        // We want to explicitly make sure that Space order values are supported and roll appropriately
        it("should properly handle rolling over at 50 characters", () => {
            // Note: we also test reversibility of large strings here.

            const maxSpaceValue = DEFAULT_ALPHABET[DEFAULT_ALPHABET.length - 1].repeat(50);
            const fiftyFirstChar = DEFAULT_ALPHABET[0].repeat(51);

            expect(nextString(maxSpaceValue)).toBe(fiftyFirstChar);
            expect(prevString(fiftyFirstChar)).toBe(maxSpaceValue);

            // We're testing that the rollover happened, which means that the next string come before
            // the maximum space order value lexicographically.
            expect(lexicographicCompare(maxSpaceValue, fiftyFirstChar) > 0).toBe(true);
        });
    });

    describe("lexicographicCompare", () => {
        it("should work", () => {
            // Simple tests
            expect(lexicographicCompare("a", "b") < 0).toBe(true);
            expect(lexicographicCompare("ab", "b") < 0).toBe(true);
            expect(lexicographicCompare("cat", "dog") < 0).toBe(true);

            // Simple tests (reversed)
            expect(lexicographicCompare("b", "a") > 0).toBe(true);
            expect(lexicographicCompare("b", "ab") > 0).toBe(true);
            expect(lexicographicCompare("dog", "cat") > 0).toBe(true);

            // Simple equality tests
            expect(lexicographicCompare("a", "a") === 0).toBe(true);
            expect(lexicographicCompare("A", "A") === 0).toBe(true);

            // ASCII rule testing
            expect(lexicographicCompare("A", "a") < 0).toBe(true);
            expect(lexicographicCompare("a", "A") > 0).toBe(true);
        });
    });

    describe("deepSortedObjectEntries", () => {
        it("should auto-return non-objects", () => {
            expect(deepSortedObjectEntries(42)).toEqual(42);
            expect(deepSortedObjectEntries("not object")).toEqual("not object");
            expect(deepSortedObjectEntries(true)).toEqual(true);
            expect(deepSortedObjectEntries([42])).toEqual([42]);
            expect(deepSortedObjectEntries(null)).toEqual(null);
            expect(deepSortedObjectEntries(undefined)).toEqual(undefined);
        });

        it("should sort objects appropriately", () => {
            const input = {
                a: 42,
                b: {
                    d: {},
                    a: "test",
                    b: "alpha",
                },
                [72]: "test",
            };
            const output: any = [
                ["72", "test"],
                ["a", 42],
                [
                    "b",
                    [
                        ["a", "test"],
                        ["b", "alpha"],
                        ["d", []],
                    ],
                ],
            ];

            expect(deepSortedObjectEntries(input)).toMatchObject(output);
        });
    });

    describe("recursivelyAssign", () => {
        it("doesn't override with null/undefined", () => {
            const result = utils.recursivelyAssign<
                {
                    string: string;
                    object: object;
                    float: number;
                },
                {}
            >(
                {
                    string: "Hello world",
                    object: {},
                    float: 0.1,
                },
                {
                    string: null,
                    object: undefined,
                },
                true,
            );

            expect(result).toStrictEqual({
                string: "Hello world",
                object: {},
                float: 0.1,
            });
        });

        it("assigns recursively", () => {
            const result = utils.recursivelyAssign<
                {
                    number: number;
                    object: object;
                    thing: string | object;
                },
                {}
            >(
                {
                    number: 42,
                    object: {
                        message: "Hello world",
                        day: "Monday",
                        langs: {
                            compiled: ["c++"],
                        },
                    },
                    thing: "string",
                },
                {
                    number: 2,
                    object: {
                        message: "How are you",
                        day: "Friday",
                        langs: {
                            compiled: ["c++", "c"],
                        },
                    },
                    thing: {
                        aSubThing: "something",
                    },
                },
            );

            expect(result).toStrictEqual({
                number: 2,
                object: {
                    message: "How are you",
                    day: "Friday",
                    langs: {
                        compiled: ["c++", "c"],
                    },
                },
                thing: {
                    aSubThing: "something",
                },
            });
        });
    });

    describe("sortEventsByLatestContentTimestamp", () => {
        const roomId = "!room:server";
        const userId = "@user:server";
        const eventWithoutContentTimestamp = mkMessage({ room: roomId, user: userId, event: true });
        // m.beacon events have timestamp in content
        const beaconEvent1 = makeBeaconEvent(userId, { timestamp: 1648804528557 });
        const beaconEvent2 = makeBeaconEvent(userId, { timestamp: 1648804528558 });
        const beaconEvent3 = makeBeaconEvent(userId, { timestamp: 1648804528000 });
        const beaconEvent4 = makeBeaconEvent(userId, { timestamp: 0 });

        it("sorts events with timestamps as later than events without", () => {
            expect(
                [beaconEvent4, eventWithoutContentTimestamp, beaconEvent1].sort(
                    utils.sortEventsByLatestContentTimestamp,
                ),
            ).toEqual([beaconEvent1, beaconEvent4, eventWithoutContentTimestamp]);
        });

        it("sorts by content timestamps correctly", () => {
            expect([beaconEvent1, beaconEvent2, beaconEvent3].sort(sortEventsByLatestContentTimestamp)).toEqual([
                beaconEvent2,
                beaconEvent1,
                beaconEvent3,
            ]);
        });
    });

    describe("isSupportedReceiptType", () => {
        it("should support m.read", () => {
            expect(utils.isSupportedReceiptType(ReceiptType.Read)).toBeTruthy();
        });

        it("should support m.read.private", () => {
            expect(utils.isSupportedReceiptType(ReceiptType.ReadPrivate)).toBeTruthy();
        });

        it("should not support other receipt types", () => {
            expect(utils.isSupportedReceiptType("this is a receipt type")).toBeFalsy();
        });
    });

    describe("recursiveMapToObject", () => {
        it.each([
            // empty map
            {
                map: new Map(),
                expected: {},
            },
            // one level map
            {
                map: new Map<any, any>([
                    ["key1", "value 1"],
                    ["key2", 23],
                    ["key3", undefined],
                    ["key4", null],
                    ["key5", [1, 2, 3]],
                ]),
                expected: { key1: "value 1", key2: 23, key3: undefined, key4: null, key5: [1, 2, 3] },
            },
            // two level map
            {
                map: new Map<any, any>([
                    [
                        "key1",
                        new Map<any, any>([
                            ["key1_1", "value 1"],
                            ["key1_2", "value 1.2"],
                        ]),
                    ],
                    ["key2", "value 2"],
                ]),
                expected: { key1: { key1_1: "value 1", key1_2: "value 1.2" }, key2: "value 2" },
            },
            // multi level map
            {
                map: new Map<any, any>([
                    ["key1", new Map<any, any>([["key1_1", new Map<any, any>([["key1_1_1", "value 1.1.1"]])]])],
                ]),
                expected: { key1: { key1_1: { key1_1_1: "value 1.1.1" } } },
            },
            // list of maps
            {
                map: new Map<any, any>([
                    [
                        "key1",
                        [new Map<any, any>([["key1_1", "value 1.1"]]), new Map<any, any>([["key1_2", "value 1.2"]])],
                    ],
                ]),
                expected: { key1: [{ key1_1: "value 1.1" }, { key1_2: "value 1.2" }] },
            },
            // map → array → array → map
            {
                map: new Map<any, any>([["key1", [[new Map<any, any>([["key2", "value 2"]])]]]]),
                expected: {
                    key1: [
                        [
                            {
                                key2: "value 2",
                            },
                        ],
                    ],
                },
            },
        ])("%# should convert the value", ({ map, expected }) => {
            expect(recursiveMapToObject(map)).toStrictEqual(expected);
        });
    });

    describe("safeSet", () => {
        it("should set a value", () => {
            const obj: Record<string, string> = {};
            safeSet(obj, "testProp", "test value");
            expect(obj).toEqual({ testProp: "test value" });
        });

        it.each(["__proto__", "prototype", "constructor"])("should raise an error when setting »%s«", (prop) => {
            expect(() => {
                safeSet(<Record<string, string>>{}, prop, "teset value");
            }).toThrow("Trying to modify prototype or constructor");
        });
    });

    describe("MapWithDefault", () => {
        it("getOrCreate should create the value if it does not exist", () => {
            const newValue = {};
            const map = new MapWithDefault(() => newValue);

            // undefined before getOrCreate
            expect(map.get("test")).toBeUndefined();

            expect(map.getOrCreate("test")).toBe(newValue);

            // default value after getOrCreate
            expect(map.get("test")).toBe(newValue);

            // test that it always returns the same value
            expect(map.getOrCreate("test")).toBe(newValue);
        });
    });

    describe("sleep", () => {
        it("resolves", async () => {
            await utils.sleep(0);
        });

        it("resolves with the provided value", async () => {
            const expected = Symbol("hi");
            const result = await utils.sleep(0, expected);
            expect(result).toBe(expected);
        });
    });

    describe("immediate", () => {
        it("resolves", async () => {
            await utils.immediate();
        });
    });

    describe("escapeRegExp", () => {
        it("should escape XYZ", () => {
            expect(escapeRegExp("[FIT-Connect Zustelldienst \\(Testumgebung\\)]")).toMatchInlineSnapshot(
                `"\\[FIT-Connect Zustelldienst \\\\\\(Testumgebung\\\\\\)\\]"`,
            );
        });
    });

    describe("globToRegexp", () => {
        it("should not explode when given regexes as globs", () => {
            const result = globToRegexp("[FIT-Connect Zustelldienst \\(Testumgebung\\)]");
            expect(result).toMatchInlineSnapshot(`"\\[FIT-Connect Zustelldienst \\\\\\(Testumgebung\\\\\\)\\]"`);
        });
    });
});

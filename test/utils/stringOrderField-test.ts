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
    ALPHABET,
    averageBetweenStrings,
    baseToString,
    midPointsBetweenStrings,
    stringToBase,
} from "../../src/utils/stringOrderField";

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
        ].forEach((c) => {
            // assert that the output string falls lexicographically between `a` and `b`
            expect([c.a, c.b, c.output].sort()[1]).toBe(c.output);
            expect(averageBetweenStrings(c.a, c.b, c.alphabet)).toBe(c.output);
        });
    });

    it("midPointsBetweenStrings", () => {
        expect(midPointsBetweenStrings("a", "e", 3)).toStrictEqual(["b", "c", "d"]);
        expect(midPointsBetweenStrings("a", "e", 0)).toStrictEqual([]);
        expect(midPointsBetweenStrings("a", "e", 4)).toStrictEqual([]);
    });
});


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

import { clamp, defaultNumber, percentageOf, percentageWithin, sum } from "../../src/utils/numbers";

describe("numbers", () => {
    describe("defaultNumber", () => {
        it("should use the default when the input is not a number", () => {
            const def = 42;

            let result = defaultNumber(null, def);
            expect(result).toBe(def);

            result = defaultNumber(undefined, def);
            expect(result).toBe(def);

            result = defaultNumber(Number.NaN, def);
            expect(result).toBe(def);
        });

        it("should use the number when it is a number", () => {
            const input = 24;
            const def = 42;
            const result = defaultNumber(input, def);
            expect(result).toBe(input);
        });
    });

    describe("clamp", () => {
        it("should clamp high numbers", () => {
            const input = 101;
            const min = 0;
            const max = 100;
            const result = clamp(input, min, max);
            expect(result).toBe(max);
        });

        it("should clamp low numbers", () => {
            const input = -1;
            const min = 0;
            const max = 100;
            const result = clamp(input, min, max);
            expect(result).toBe(min);
        });

        it("should not clamp numbers in range", () => {
            const input = 50;
            const min = 0;
            const max = 100;
            const result = clamp(input, min, max);
            expect(result).toBe(input);
        });

        it("should clamp floats", () => {
            const min = -0.1;
            const max = +0.1;

            let result = clamp(-1.2, min, max);
            expect(result).toBe(min);

            result = clamp(1.2, min, max);
            expect(result).toBe(max);

            result = clamp(0.02, min, max);
            expect(result).toBe(0.02);
        });
    });

    describe("sum", () => {
        it("should sum", () => {
            // duh
            const result = sum(1, 2, 1, 4);
            expect(result).toBe(8);
        });
    });

    describe("percentageWithin", () => {
        it("should work within 0-100", () => {
            const result = percentageWithin(0.4, 0, 100);
            expect(result).toBe(40);
        });

        it("should work within 0-100 when pct > 1", () => {
            const result = percentageWithin(1.4, 0, 100);
            expect(result).toBe(140);
        });

        it("should work within 0-100 when pct < 0", () => {
            const result = percentageWithin(-1.4, 0, 100);
            expect(result).toBe(-140);
        });

        it("should work with ranges other than 0-100", () => {
            const result = percentageWithin(0.4, 10, 20);
            expect(result).toBe(14);
        });

        it("should work with ranges other than 0-100 when pct > 1", () => {
            const result = percentageWithin(1.4, 10, 20);
            expect(result).toBe(24);
        });

        it("should work with ranges other than 0-100 when pct < 0", () => {
            const result = percentageWithin(-1.4, 10, 20);
            expect(result).toBe(-4);
        });

        it("should work with floats", () => {
            const result = percentageWithin(0.4, 10.2, 20.4);
            expect(result).toBe(14.28);
        });
    });

    // These are the inverse of percentageWithin
    describe("percentageOf", () => {
        it("should work within 0-100", () => {
            const result = percentageOf(40, 0, 100);
            expect(result).toBe(0.4);
        });

        it("should work within 0-100 when val > 100", () => {
            const result = percentageOf(140, 0, 100);
            expect(result).toBe(1.4);
        });

        it("should work within 0-100 when val < 0", () => {
            const result = percentageOf(-140, 0, 100);
            expect(result).toBe(-1.4);
        });

        it("should work with ranges other than 0-100", () => {
            const result = percentageOf(14, 10, 20);
            expect(result).toBe(0.4);
        });

        it("should work with ranges other than 0-100 when val > 100", () => {
            const result = percentageOf(24, 10, 20);
            expect(result).toBe(1.4);
        });

        it("should work with ranges other than 0-100 when val < 0", () => {
            const result = percentageOf(-4, 10, 20);
            expect(result).toBe(-1.4);
        });

        it("should work with floats", () => {
            const result = percentageOf(14.28, 10.2, 20.4);
            expect(result).toBe(0.4);
        });

        it("should return 0 for values that cause a division by zero", () => {
            expect(percentageOf(0, 0, 0)).toBe(0);
        });
    });
});

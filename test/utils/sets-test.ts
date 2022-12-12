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

import { setHasDiff } from "../../src/utils/sets";

describe("sets", () => {
    describe("setHasDiff", () => {
        it("should flag true on A length > B length", () => {
            const a = new Set([1, 2, 3, 4]);
            const b = new Set([1, 2, 3]);
            const result = setHasDiff(a, b);
            expect(result).toBe(true);
        });

        it("should flag true on A length < B length", () => {
            const a = new Set([1, 2, 3]);
            const b = new Set([1, 2, 3, 4]);
            const result = setHasDiff(a, b);
            expect(result).toBe(true);
        });

        it("should flag true on element differences", () => {
            const a = new Set([1, 2, 3]);
            const b = new Set([4, 5, 6]);
            const result = setHasDiff(a, b);
            expect(result).toBe(true);
        });

        it("should flag false if same but order different", () => {
            const a = new Set([1, 2, 3]);
            const b = new Set([3, 1, 2]);
            const result = setHasDiff(a, b);
            expect(result).toBe(false);
        });

        it("should flag false if same", () => {
            const a = new Set([1, 2, 3]);
            const b = new Set([1, 2, 3]);
            const result = setHasDiff(a, b);
            expect(result).toBe(false);
        });
    });
});

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

import { iterableDiff, iterableIntersection } from "../../src/utils/iterables";

describe("iterables", () => {
    describe("iterableIntersection", () => {
        it("should return the intersection", () => {
            const a = [1, 2, 3];
            const b = [1, 2, 4]; // note diff
            const result = iterableIntersection(a, b);
            expect(result).toBeDefined();
            expect(result).toHaveLength(2);
            expect(result).toEqual([1, 2]);
        });

        it("should return an empty array on no matches", () => {
            const a = [1, 2, 3];
            const b = [4, 5, 6];
            const result = iterableIntersection(a, b);
            expect(result).toBeDefined();
            expect(result).toHaveLength(0);
        });
    });

    describe("iterableDiff", () => {
        it("should see added from A->B", () => {
            const a = [1, 2, 3];
            const b = [1, 2, 3, 4];
            const result = iterableDiff(a, b);
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
            const result = iterableDiff(a, b);
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
            const result = iterableDiff(a, b);
            expect(result).toBeDefined();
            expect(result.added).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.added).toHaveLength(1);
            expect(result.removed).toHaveLength(1);
            expect(result.added).toEqual([4]);
            expect(result.removed).toEqual([3]);
        });
    });
});

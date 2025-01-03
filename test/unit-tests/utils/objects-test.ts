/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    objectClone,
    objectDiff,
    objectExcluding,
    objectHasDiff,
    objectKeyChanges,
    objectShallowClone,
    objectWithOnly,
} from "../../../src/utils/objects";

describe("objects", () => {
    describe("objectExcluding", () => {
        it("should exclude the given properties", () => {
            const input = { hello: "world", test: true };
            const output = { hello: "world" };
            const props = ["test", "doesnotexist"]; // we also make sure it doesn't explode on missing props
            const result = objectExcluding(input, <any>props); // any is to test the missing prop
            expect(result).toBeDefined();
            expect(result).toMatchObject(output);
        });
    });

    describe("objectWithOnly", () => {
        it("should exclusively use the given properties", () => {
            const input = { hello: "world", test: true };
            const output = { hello: "world" };
            const props = ["hello", "doesnotexist"]; // we also make sure it doesn't explode on missing props
            const result = objectWithOnly(input, <any>props); // any is to test the missing prop
            expect(result).toBeDefined();
            expect(result).toMatchObject(output);
        });
    });

    describe("objectShallowClone", () => {
        it("should create a new object", () => {
            const input = { test: 1 };
            const result = objectShallowClone(input);
            expect(result).toBeDefined();
            expect(result).not.toBe(input);
            expect(result).toMatchObject(input);
        });

        it("should only clone the top level properties", () => {
            const input = { a: 1, b: { c: 2 } };
            const result = objectShallowClone(input);
            expect(result).toBeDefined();
            expect(result).toMatchObject(input);
            expect(result.b).toBe(input.b);
        });

        it("should support custom clone functions", () => {
            const input = { a: 1, b: 2 };
            const output = { a: 4, b: 8 };
            const result = objectShallowClone(input, (k, v) => {
                // XXX: inverted expectation for ease of assertion
                expect(Object.keys(input)).toContain(k);

                return v * 4;
            });
            expect(result).toBeDefined();
            expect(result).toMatchObject(output);
        });
    });

    describe("objectHasDiff", () => {
        it("should return false for the same pointer", () => {
            const a = {};
            const result = objectHasDiff(a, a);
            expect(result).toBe(false);
        });

        it("should return true if keys for A > keys for B", () => {
            const a = { a: 1, b: 2 };
            const b = { a: 1 };
            const result = objectHasDiff(a, b);
            expect(result).toBe(true);
        });

        it("should return true if keys for A < keys for B", () => {
            const a = { a: 1 };
            const b = { a: 1, b: 2 };
            const result = objectHasDiff(a, b);
            expect(result).toBe(true);
        });

        it("should return false if the objects are the same but different pointers", () => {
            const a = { a: 1, b: 2 };
            const b = { a: 1, b: 2 };
            const result = objectHasDiff(a, b);
            expect(result).toBe(false);
        });

        it("should consider pointers when testing values", () => {
            const a = { a: {}, b: 2 }; // `{}` is shorthand for `new Object()`
            const b = { a: {}, b: 2 };
            const result = objectHasDiff(a, b);
            expect(result).toBe(true); // even though the keys are the same, the value pointers vary
        });
    });

    describe("objectDiff", () => {
        it("should return empty sets for the same object", () => {
            const a = { a: 1, b: 2 };
            const b = { a: 1, b: 2 };
            const result = objectDiff(a, b);
            expect(result).toBeDefined();
            expect(result.changed).toBeDefined();
            expect(result.added).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.changed).toHaveLength(0);
            expect(result.added).toHaveLength(0);
            expect(result.removed).toHaveLength(0);
        });

        it("should return empty sets for the same object pointer", () => {
            const a = { a: 1, b: 2 };
            const result = objectDiff(a, a);
            expect(result).toBeDefined();
            expect(result.changed).toBeDefined();
            expect(result.added).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.changed).toHaveLength(0);
            expect(result.added).toHaveLength(0);
            expect(result.removed).toHaveLength(0);
        });

        it("should indicate when property changes are made", () => {
            const a = { a: 1, b: 2 };
            const b = { a: 11, b: 2 };
            const result = objectDiff(a, b);
            expect(result.changed).toBeDefined();
            expect(result.added).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.changed).toHaveLength(1);
            expect(result.added).toHaveLength(0);
            expect(result.removed).toHaveLength(0);
            expect(result.changed).toEqual(["a"]);
        });

        it("should indicate when properties are added", () => {
            const a = { a: 1, b: 2 };
            const b = { a: 1, b: 2, c: 3 };
            const result = objectDiff(a, b);
            expect(result.changed).toBeDefined();
            expect(result.added).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.changed).toHaveLength(0);
            expect(result.added).toHaveLength(1);
            expect(result.removed).toHaveLength(0);
            expect(result.added).toEqual(["c"]);
        });

        it("should indicate when properties are removed", () => {
            const a = { a: 1, b: 2 };
            const b = { a: 1 };
            const result = objectDiff(a, b);
            expect(result.changed).toBeDefined();
            expect(result.added).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.changed).toHaveLength(0);
            expect(result.added).toHaveLength(0);
            expect(result.removed).toHaveLength(1);
            expect(result.removed).toEqual(["b"]);
        });

        it("should indicate when multiple aspects change", () => {
            const a = { a: 1, b: 2, c: 3 };
            const b: typeof a | { d: number } = { a: 1, b: 22, d: 4 };
            const result = objectDiff(a, b);
            expect(result.changed).toBeDefined();
            expect(result.added).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.changed).toHaveLength(1);
            expect(result.added).toHaveLength(1);
            expect(result.removed).toHaveLength(1);
            expect(result.changed).toEqual(["b"]);
            expect(result.removed).toEqual(["c"]);
            expect(result.added).toEqual(["d"]);
        });
    });

    describe("objectKeyChanges", () => {
        it("should return an empty set if no properties changed", () => {
            const a = { a: 1, b: 2 };
            const b = { a: 1, b: 2 };
            const result = objectKeyChanges(a, b);
            expect(result).toBeDefined();
            expect(result).toHaveLength(0);
        });

        it("should return an empty set if no properties changed for the same pointer", () => {
            const a = { a: 1, b: 2 };
            const result = objectKeyChanges(a, a);
            expect(result).toBeDefined();
            expect(result).toHaveLength(0);
        });

        it("should return properties which were changed, added, or removed", () => {
            const a = { a: 1, b: 2, c: 3 };
            const b: typeof a | { d: number } = { a: 1, b: 22, d: 4 };
            const result = objectKeyChanges(a, b);
            expect(result).toBeDefined();
            expect(result).toHaveLength(3);
            expect(result).toEqual(["c", "d", "b"]); // order isn't important, but the test cares
        });
    });

    describe("objectClone", () => {
        it("should deep clone an object", () => {
            const a = {
                hello: "world",
                test: {
                    another: "property",
                    test: 42,
                    third: {
                        prop: true,
                    },
                },
            };
            const result = objectClone(a);
            expect(result).toBeDefined();
            expect(result).not.toBe(a);
            expect(result).toMatchObject(a);
            expect(result.test).not.toBe(a.test);
            expect(result.test.third).not.toBe(a.test.third);
        });
    });
});

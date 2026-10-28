/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { getAtJsonPointer, joinJsonPointer, parseJsonPointer, setAtJsonPointer } from "./jsonPointer";

describe("jsonPointer", () => {
    describe("parseJsonPointer", () => {
        it("treats the empty pointer and the root pointer as the whole document", () => {
            expect(parseJsonPointer("")).toEqual([]);
            expect(parseJsonPointer("/")).toEqual([]);
        });

        it("splits and unescapes tokens", () => {
            expect(parseJsonPointer("/a/b~1c/d~0e")).toEqual(["a", "b/c", "d~e"]);
        });
    });

    describe("joinJsonPointer", () => {
        it("returns the pointer unchanged without a scope", () => {
            expect(joinJsonPointer(undefined, "/name")).toBe("/name");
            expect(joinJsonPointer("/", "/name")).toBe("/name");
        });

        it("prefixes the scope", () => {
            expect(joinJsonPointer("/items/0", "/name")).toBe("/items/0/name");
            expect(joinJsonPointer("/items/0", "name")).toBe("/items/0/name");
            expect(joinJsonPointer("/items/0", "/")).toBe("/items/0");
        });
    });

    describe("getAtJsonPointer", () => {
        const doc = { user: { name: "Alice", tags: ["a", "b"] } };

        it("reads nested values and array items", () => {
            expect(getAtJsonPointer(doc, "/user/name")).toBe("Alice");
            expect(getAtJsonPointer(doc, "/user/tags/1")).toBe("b");
            expect(getAtJsonPointer(doc, "/")).toBe(doc);
        });

        it("returns undefined for missing paths and non-containers", () => {
            expect(getAtJsonPointer(doc, "/user/missing")).toBeUndefined();
            expect(getAtJsonPointer(doc, "/user/name/0")).toBeUndefined();
            expect(getAtJsonPointer(doc, "/user/tags/x")).toBeUndefined();
            expect(getAtJsonPointer(undefined, "/user")).toBeUndefined();
        });
    });

    describe("setAtJsonPointer", () => {
        it("replaces the document at the root pointer", () => {
            expect(setAtJsonPointer({ a: 1 }, "/", { b: 2 })).toEqual({ b: 2 });
        });

        it("writes nested values without mutating the input", () => {
            const doc = { user: { name: "Alice" } };
            const result = setAtJsonPointer(doc, "/user/email", "alice@example.org");

            expect(result).toEqual({ user: { name: "Alice", email: "alice@example.org" } });
            expect(doc).toEqual({ user: { name: "Alice" } });
        });

        it("creates intermediate objects", () => {
            expect(setAtJsonPointer(undefined, "/a/b/c", true)).toEqual({ a: { b: { c: true } } });
        });

        it("writes into and appends to arrays", () => {
            expect(setAtJsonPointer({ list: [1, 2] }, "/list/0", 9)).toEqual({ list: [9, 2] });
            expect(setAtJsonPointer({ list: [1, 2] }, "/list/-", 3)).toEqual({ list: [1, 2, 3] });
        });

        it("deletes keys and array items when the value is undefined", () => {
            expect(setAtJsonPointer({ a: 1, b: 2 }, "/b", undefined)).toEqual({ a: 1 });
            expect(setAtJsonPointer({ list: [1, 2, 3] }, "/list/1", undefined)).toEqual({ list: [1, 3] });
        });
    });
});

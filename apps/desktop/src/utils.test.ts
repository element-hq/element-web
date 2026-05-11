/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeEach, vi } from "vitest";
import { fs as memfs, vol } from "memfs";

import { loadJsonFile, tryPaths, randomArray } from "./utils.js";

vi.mock("node:fs", () => ({ default: memfs }));
vi.mock("node:fs/promises", () => ({ default: memfs.promises }));

beforeEach(() => {
    // Reset the state of the in-memory fs
    vol.reset();
});

describe("randomArray", () => {
    it("should return an array matching the requested size", async () => {
        function toUnpaddedBase64Size(size: number): number {
            return Math.ceil((4 * size) / 3);
        }

        await expect(randomArray(100)).resolves.toHaveLength(toUnpaddedBase64Size(100));
        await expect(randomArray(32)).resolves.toHaveLength(toUnpaddedBase64Size(32));
    });

    it("should return a unique random array", async () => {
        const arr1 = await randomArray(60);
        const arr2 = await randomArray(60);
        expect(arr1).not.toEqual(arr2);
    });
});

describe("loadJsonFile", () => {
    beforeEach(() => {
        vol.fromJSON({
            "./file.json": JSON.stringify({ file1: true }),
            "./nested/deep/file.json": JSON.stringify({ file2: true }),
        });
    });

    it("should load and parse a JSON file correctly", () => {
        expect(loadJsonFile("file.json")).toStrictEqual({ file1: true });
    });

    it("should use args as path segments", () => {
        expect(loadJsonFile("nested", "deep", "file.json")).toStrictEqual({ file2: true });
    });

    it("should return an empty object when file does not exist", () => {
        expect(loadJsonFile("unknown-file.json")).toStrictEqual({});
    });
});

describe("tryPaths", () => {
    beforeEach(() => {
        vol.fromNestedJSON({
            "./dirA/": {},
            "./dir/dirB/": {},
        });
    });

    it("should find file relative to given root", async () => {
        await expect(tryPaths("name", "dir", ["dirB"])).resolves.toEqual("dir/dirB/");
    });

    it("should handle unknown paths", async () => {
        await expect(tryPaths("name", ".", ["dirB", "dirA"])).resolves.toEqual("dirA/");
    });

    it("should throw error if file does not exist", async () => {
        await expect(tryPaths("name", "dir", ["a.json", "b.json"])).rejects.toThrow("Failed to find name path");
    });
});

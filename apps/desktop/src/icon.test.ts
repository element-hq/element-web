/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeEach, vi } from "vitest";
import { fs as memfs, vol } from "memfs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getIconPath } from "./icon.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

vi.mock("node:fs/promises", () => ({ default: memfs.promises }));

beforeEach(() => {
    // Reset the state of the in-memory fs
    vol.reset();
});

describe("getIconPath", () => {
    beforeEach(() => {
        vol.fromJSON(
            {
                "build/icon.png": "png",
                "build/icon.ico": "ico",
            },
            resolve(__dirname, "../webapp"),
        );
    });

    it("should use .ico on Windows", async () => {
        vi.spyOn(process, "platform", "get").mockReturnValue("win32");
        await expect(getIconPath()).resolves.toEqual(resolve(__dirname, "../build/icon.ico"));
    });
    it("should use .png on macOS", async () => {
        vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
        await expect(getIconPath()).resolves.toEqual(resolve(__dirname, "../build/icon.png"));
    });
    it("should use .png on Linux", async () => {
        vi.spyOn(process, "platform", "get").mockReturnValue("linux");
        await expect(getIconPath()).resolves.toEqual(resolve(__dirname, "../build/icon.png"));
    });
});

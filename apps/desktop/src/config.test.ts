/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeEach, vi } from "vitest";
import { fs as memfs, vol } from "memfs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { type ConfigOptions } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

vi.mock("node:fs", () => ({ default: memfs }));
vi.mock("node:fs/promises", () => ({ default: memfs.promises }));

vi.mock("electron", () => ({
    app: {
        getPath: vi.fn().mockReturnValue("/Users/name/Library/Application Support/Element"),
    },
}));

beforeEach(() => {
    // Reset the state of the in-memory fs
    vol.reset();
});

describe("loadConfig", () => {
    let loadConfig: (localConfigPath: string | undefined) => Promise<ConfigOptions>;

    beforeEach(async () => {
        vol.fromJSON(
            {
                "../webapp.asar/config.json": JSON.stringify({
                    web_base_url: "https://chat.org.com",
                }),
            },
            __dirname,
        );

        vi.resetModules();
        ({ loadConfig } = await import("./config.js"));
    });

    it("should ignore localConfigPath if does not exist", async () => {
        const config = await loadConfig(resolve(__dirname, "../custom-config.json"));
        expect(config.brand).toBe("Element");
        expect(config.web_base_url).toBe("https://chat.org.com");
    });

    it("should read localConfigPath if exists", async () => {
        vol.fromJSON({
            "/home/custom-config.json": JSON.stringify({
                brand: "foobar",
            }),
        });

        const config = await loadConfig("/home/custom-config.json");
        expect(config.brand).toBe("foobar");
    });

    it("should load default local config if exists", async () => {
        vol.fromJSON({
            "/Users/name/Library/Application Support/Element/config.json": JSON.stringify({
                brand: "foobar",
            }),
        });

        const config = await loadConfig(undefined);
        expect(config.brand).toBe("foobar");
    });

    it("should apply defaults to any missing fields", async () => {
        vol.fromJSON({
            "/home/custom-config.json": JSON.stringify({
                brand: "foobar",
            }),
        });

        const config = await loadConfig("/home/custom-config.json");
        expect(config.help_url).toBe("https://element.io/help");
        expect(config.web_base_url).toBe("https://chat.org.com");
    });
});

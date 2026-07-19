/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeEach, vi } from "vitest";
import { fs as memfs, vol } from "memfs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dialog } from "electron";

import { type ConfigOptions } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

vi.mock("node:fs", () => ({ default: memfs }));
vi.mock("node:fs/promises", () => ({ default: memfs.promises }));

vi.mock("electron", () => ({
    app: {
        getPath: vi.fn().mockReturnValue("/Users/name/Library/Application Support/Element"),
        whenReady: (): Promise<void> => Promise.resolve(),
    },
    dialog: {
        showMessageBox: vi.fn(),
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
                    default_hs_url: "https://matrix.org.com",
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
        expect(config.default_hs_url).toBe("https://matrix.org.com");
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

    it("should support all config files missing", async () => {
        vol.reset();
        vol.fromJSON(
            {
                "../webapp.asar/version": "v1.2.3",
            },
            __dirname,
        );

        const config = await loadConfig(undefined);
        expect(config.help_url).toBe("https://element.io/help");
        expect(config.web_base_url).toBe("https://app.element.io/");
    });

    it("should handle key conflicts around default homeserver config", async () => {
        vol.fromJSON({
            "/home/custom-config.json": JSON.stringify({
                default_server_name: "other-org.com",
            }),
        });

        const config = await loadConfig("/home/custom-config.json");
        expect(config.default_server_name).toBe("other-org.com");
        expect(config.default_hs_url).toBeUndefined();
        expect(config.default_server_config).toBeUndefined();
    });

    it("should map module paths correctly", async () => {
        vol.fromJSON(
            {
                "../webapp.asar/config.json": JSON.stringify({
                    web_base_url: "https://chat.org.com",
                    default_hs_url: "https://matrix.org.com",
                    modules: ["/modules/banner", "module2"],
                }),
            },
            __dirname,
        );

        const config = await loadConfig("/home/custom-config.json");
        expect(config.help_url).toBe("https://element.io/help");
        expect(config.web_base_url).toBe("https://chat.org.com");
        expect(config.modules).toStrictEqual(["/webapp/modules/banner", "module2"]);
    });

    it("should show a dialog when encountering a SyntaxError", async () => {
        vol.fromJSON({
            "/home/custom-config.json": "NOT_JSON",
        });

        await loadConfig("/home/custom-config.json");
        expect(dialog.showMessageBox).toHaveBeenCalledWith({
            detail: "Unexpected token 'N', \"NOT_JSON\" is not valid JSON",
            message:
                "Your custom Element configuration contains invalid JSON. Please correct the problem and reopen Element.",
            title: "Your Element is misconfigured",
            type: "error",
        });
    });
});

describe("getConfig", () => {
    let loadConfig: (localConfigPath: string | undefined) => Promise<ConfigOptions>;
    let getConfig: () => ConfigOptions;

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
        ({ loadConfig, getConfig } = await import("./config.js"));
    });

    it("should return undefined if loadConfig has not been called", () => {
        expect(getConfig()).toBeUndefined();
    });

    it("should return the config once it is loaded", async () => {
        const config = await loadConfig(undefined);
        expect(config.web_base_url).toBe("https://chat.org.com");
        expect(config).toStrictEqual(getConfig());
    });
});

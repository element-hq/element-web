/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Platform } from "electron-builder";

import { writeMacReleasesJson } from "./mac-releases.ts";

describe("writeMacReleasesJson", () => {
    let outDir: string;

    beforeEach(async () => {
        outDir = await fsp.mkdtemp(path.join(os.tmpdir(), "mac-releases-"));
    });

    afterEach(async () => {
        await fsp.rm(outDir, { recursive: true, force: true });
    });

    /** Builds the result of a build for a platform into outDir, producing the given artifacts. */
    const build = (platform: Platform, ...artifacts: string[]): Parameters<typeof writeMacReleasesJson>[0] => ({
        outDir,
        artifactPaths: artifacts.map((artifact) => path.join(outDir, artifact)),
        platformToTargets: new Map([[platform, new Map()]]),
    });

    const readJson = async (name: string): Promise<unknown> =>
        JSON.parse(await fsp.readFile(path.join(outDir, name), "utf8"));

    it("writes releases.json & releases-legacy.json pointing at the zip", async () => {
        const result = build(
            Platform.MAC,
            "Element Nightly-2026111301-universal.dmg",
            "Element Nightly-2026111301-universal-mac.zip",
        );

        const written = await writeMacReleasesJson(result, "2026111301", "https://packages.element.io/nightly");

        expect(written).toEqual([path.join(outDir, "releases.json"), path.join(outDir, "releases-legacy.json")]);
        const url = "https://packages.element.io/nightly/update/macos/Element%20Nightly-2026111301-universal-mac.zip";
        expect(await readJson("releases.json")).toEqual({
            currentRelease: "2026111301",
            releases: [{ version: "2026111301", updateTo: { version: "2026111301", url } }],
        });
        expect(await readJson("releases-legacy.json")).toEqual({ url });
    });

    it("writes nothing if the build is not going to be deployed", async () => {
        await expect(writeMacReleasesJson(build(Platform.MAC, "a-mac.zip"), "1.0.0", undefined)).resolves.toEqual([]);
        await expect(fsp.readdir(outDir)).resolves.toEqual([]);
    });

    it("writes nothing for other platforms", async () => {
        await expect(
            writeMacReleasesJson(build(Platform.LINUX, "a.deb"), "1.0.0", "https://example.com"),
        ).resolves.toEqual([]);
        await expect(fsp.readdir(outDir)).resolves.toEqual([]);
    });

    it.each([
        ["no zip", []],
        ["several zips", ["a-mac.zip", "b-mac.zip"]],
    ])("throws if there is %s", async (_, zips) => {
        await expect(
            writeMacReleasesJson(build(Platform.MAC, ...zips), "1.0.0", "https://example.com"),
        ).rejects.toThrow("Expected exactly one macOS zip");
    });
});

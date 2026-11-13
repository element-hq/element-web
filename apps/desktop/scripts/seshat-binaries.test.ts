/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AfterPackContext, Arch, log } from "electron-builder";

import { pruneSeshatBinaries } from "./seshat-binaries.ts";

const ALL_BINARIES = [
    "seshat-darwin-arm64",
    "seshat-darwin-x64",
    "seshat-linux-arm64",
    "seshat-linux-x64",
    "seshat-win32-arm64",
    "seshat-win32-x64",
];

describe("pruneSeshatBinaries", () => {
    let appOutDir: string;
    let modulesDir: string;

    /** Builds the afterPack context of an app packaged into appOutDir, with its resources in appOutDir/resources. */
    const context = (electronPlatformName: string, arch: Arch): AfterPackContext =>
        ({
            appOutDir,
            arch,
            electronPlatformName,
            packager: { getResourcesDir: (dir: string) => path.join(dir, "resources") },
        }) as unknown as AfterPackContext;

    beforeEach(async () => {
        vi.spyOn(log, "info").mockImplementation(() => {});
        appOutDir = await fsp.mkdtemp(path.join(os.tmpdir(), "seshat-binaries-"));
        modulesDir = path.join(appOutDir, "resources", "app.asar.unpacked", "node_modules", "@matrix-org");
        // seshat itself and an unrelated package must never be pruned
        for (const dir of [...ALL_BINARIES, "seshat", "olm"]) {
            await fsp.mkdir(path.join(modulesDir, dir), { recursive: true });
            await fsp.writeFile(path.join(modulesDir, dir, "index.node"), "");
        }
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await fsp.rm(appOutDir, { recursive: true, force: true });
    });

    it.each([
        ["linux", "x64", ["seshat-linux-x64"]],
        ["linux", "arm64", ["seshat-linux-arm64"]],
        ["win32", "x64", ["seshat-win32-x64"]],
        ["win32", "arm64", ["seshat-win32-arm64"]],
        // Both halves of a universal build must contain the same files
        ["darwin", "x64", ["seshat-darwin-arm64", "seshat-darwin-x64"]],
        ["darwin", "arm64", ["seshat-darwin-arm64", "seshat-darwin-x64"]],
        ["darwin", "universal", ["seshat-darwin-arm64", "seshat-darwin-x64"]],
    ])("keeps only the binaries needed for %s %s", async (platform, arch, kept) => {
        await pruneSeshatBinaries(context(platform, Arch[arch as keyof typeof Arch]));

        await expect(fsp.readdir(modulesDir).then((dirs) => dirs.sort())).resolves.toEqual(
            ["olm", "seshat", ...kept].sort(),
        );
    });

    it("does nothing if the build has no unpacked seshat binaries", async () => {
        await fsp.rm(path.join(appOutDir, "resources"), { recursive: true });

        await expect(pruneSeshatBinaries(context("linux", Arch.x64))).resolves.toBeUndefined();
    });
});

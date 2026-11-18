/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Platform, type Target } from "electron-builder";

import { assertArtifactsPresent } from "./artifacts.ts";

describe("assertArtifactsPresent", () => {
    let outDir: string;

    beforeEach(async () => {
        outDir = await fsp.mkdtemp(path.join(os.tmpdir(), "artifacts-"));
    });

    afterEach(async () => {
        await fsp.rm(outDir, { recursive: true, force: true });
    });

    /** Builds the result of a build of the given targets for a platform into outDir. */
    const build = (platform: Platform, ...targets: string[]): Parameters<typeof assertArtifactsPresent>[0] => ({
        outDir,
        platformToTargets: new Map([[platform, new Map(targets.map((name) => [name, { name } as Target]))]]),
    });

    const createFiles = async (...files: string[]): Promise<void> => {
        for (const file of files) {
            await fsp.mkdir(path.dirname(path.join(outDir, file)), { recursive: true });
            await fsp.writeFile(path.join(outDir, file), "");
        }
    };

    it("passes a complete Linux build", async () => {
        await createFiles(
            "element-desktop_1.12.32_amd64.deb",
            "element-desktop-1.12.32.tar.gz",
            "linux-unpacked/element-desktop",
        );

        await expect(assertArtifactsPresent(build(Platform.LINUX, "deb", "tar.gz"))).resolves.toBeUndefined();
    });

    it("passes a complete macOS build", async () => {
        await createFiles("Element-1.12.32-universal.dmg", "Element-1.12.32-universal-mac.zip");

        await expect(assertArtifactsPresent(build(Platform.MAC, "dmg", "zip"))).resolves.toBeUndefined();
    });

    it("passes a complete Windows build", async () => {
        await createFiles(
            "win-arm64-unpacked/Element.exe",
            "squirrel-windows-arm64/Element Setup 1.12.32.exe",
            "squirrel-windows-arm64/element-desktop-1.12.32-full.nupkg",
            "squirrel-windows-arm64/RELEASES",
            "Element 1.12.32.msi",
        );

        await expect(assertArtifactsPresent(build(Platform.WINDOWS, "squirrel", "msi"))).resolves.toBeUndefined();
    });

    it("fails listing each missing file", async () => {
        await createFiles("squirrel-windows/Element Setup 1.12.32.exe");

        await expect(assertArtifactsPresent(build(Platform.WINDOWS, "squirrel", "msi"))).rejects.toThrow(
            [
                "Build is missing expected artifacts:",
                "windows build: unpacked executable",
                "windows squirrel target: Squirrel full nupkg",
                "windows squirrel target: Squirrel RELEASES file",
                "windows msi target: MSI installer",
            ].join("\n"),
        );
    });

    it("only checks the targets which were built", async () => {
        await createFiles("Element-1.12.32-universal.dmg");

        await expect(assertArtifactsPresent(build(Platform.MAC, "dmg"))).resolves.toBeUndefined();
        await expect(assertArtifactsPresent(build(Platform.MAC, "zip"))).rejects.toThrow(
            ["Build is missing expected artifacts:", "mac zip target: macOS zip"].join("\n"),
        );
    });

    it("does not match files nested deeper than one directory", async () => {
        await createFiles("mac-universal/Element.app/Contents/Element-mac.zip");

        await expect(assertArtifactsPresent(build(Platform.MAC, "zip"))).rejects.toThrow(
            ["Build is missing expected artifacts:", "mac zip target: macOS zip"].join("\n"),
        );
    });

    it("ignores targets without expectations", async () => {
        await expect(assertArtifactsPresent(build(Platform.LINUX, "dir", "AppImage"))).resolves.toBeUndefined();
    });
});

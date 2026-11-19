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

import { assertNativeLibraries } from "./native-libraries.ts";
import type { Exec } from "./exec.ts";

/**
 * Builds `readelf --file-header --dynamic --version-info --wide` output with the given fields.
 */
function readelfOutput({
    machine = "Advanced Micro Devices X86-64",
    needed = ["libc.so.6"],
    glibc = ["2.2.5", "2.14"],
}: { machine?: string; needed?: string[]; glibc?: string[] } = {}): string {
    return [
        "ELF Header:",
        "  Class:                             ELF64",
        `  Machine:                           ${machine}`,
        "",
        "Dynamic section at offset 0x2de0 contains 26 entries:",
        "  Tag        Type                         Name/Value",
        ...needed.map((lib) => ` 0x0000000000000001 (NEEDED)             Shared library: [${lib}]`),
        "",
        "Version needs section '.gnu.version_r' contains 1 entry:",
        "  000000: Version: 1  File: libc.so.6  Cnt: 2",
        ...glibc.map((version) => `  0x0010:   Name: GLIBC_${version}  Flags: none  Version: 3`),
        "",
    ].join("\n");
}

describe("assertNativeLibraries", () => {
    let appOutDir: string;
    let executable: string;
    let nodeModule: string;

    /** Builds the afterPack context of an app packaged into appOutDir. */
    const context = (arch = Arch.x64, electronPlatformName = "linux"): AfterPackContext =>
        ({
            appOutDir,
            arch,
            electronPlatformName,
            packager: { executableName: "element-desktop" },
        }) as unknown as AfterPackContext;

    beforeEach(async () => {
        appOutDir = await fsp.mkdtemp(path.join(os.tmpdir(), "native-libraries-"));
        executable = path.join(appOutDir, "element-desktop");
        nodeModule = path.join(appOutDir, "resources", "app.asar.unpacked", "node_modules", "mod", "mod.node");
        await fsp.mkdir(path.dirname(nodeModule), { recursive: true });
        await fsp.writeFile(executable, "");
        await fsp.writeFile(nodeModule, "");
        await fsp.writeFile(path.join(path.dirname(nodeModule), "index.js"), "");
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
        await fsp.rm(appOutDir, { recursive: true, force: true });
    });

    it("passes valid binaries and checks every .node file and the executable", async () => {
        const exec = vi.fn<Exec>().mockResolvedValue(readelfOutput());

        await expect(assertNativeLibraries(context(), { fatal: true, exec })).resolves.toBeUndefined();

        const checked = exec.mock.calls.map(([, args]) => args.at(-1));
        expect(checked.sort()).toEqual([executable, nodeModule].sort());
        expect(exec).toHaveBeenCalledWith("readelf", expect.arrayContaining(["--dynamic", "--version-info"]));
    });

    it.each(["darwin", "win32"])("ignores apps packaged for %s", async (platform) => {
        const exec = vi.fn<Exec>();

        await assertNativeLibraries(context(Arch.x64, platform), { fatal: true, exec });
        expect(exec).not.toHaveBeenCalled();
    });

    it("fails on binaries built for the wrong architecture", async () => {
        const exec = vi.fn<Exec>().mockResolvedValue(readelfOutput({ machine: "Advanced Micro Devices X86-64" }));

        await expect(assertNativeLibraries(context(Arch.arm64), { fatal: true, exec })).rejects.toThrow(
            `Native library checks failed for linux-arm64:\n`,
        );
        await expect(assertNativeLibraries(context(Arch.arm64), { fatal: true, exec })).rejects.toThrow(
            `${executable}: built for 'Advanced Micro Devices X86-64', expected 'AArch64' for arm64`,
        );
    });

    it("fails on dynamically linked libcrypto & libsqlcipher", async () => {
        const exec = vi.fn<Exec>(async (_file, args) =>
            args.at(-1) === nodeModule
                ? readelfOutput({ needed: ["libc.so.6", "libcrypto.so.3", "libsqlcipher.so.0"] })
                : readelfOutput(),
        );

        await expect(assertNativeLibraries(context(), { fatal: true, exec })).rejects.toThrow(
            [
                "Native library checks failed for linux-x64:",
                `${nodeModule}: dynamically links libcrypto.so.3, which should be linked statically`,
                `${nodeModule}: dynamically links libsqlcipher.so.0, which should be linked statically`,
            ].join("\n"),
        );
    });

    it("fails on glibc versions newer than the maximum, comparing numerically", async () => {
        const exec = vi.fn<Exec>(async (_file, args) =>
            args.at(-1) === executable ? readelfOutput({ glibc: ["2.9", "2.34", "2.35"] }) : readelfOutput(),
        );

        await expect(assertNativeLibraries(context(), { fatal: true, exec, maxGlibc: "2.34" })).rejects.toThrow(
            [
                "Native library checks failed for linux-x64:",
                `${executable}: requires GLIBC 2.35, which is newer than the supported 2.34`,
            ].join("\n"),
        );
    });

    it("fails on files readelf fails to read", async () => {
        const exec = vi.fn<Exec>().mockRejectedValue(new Error("Not an ELF file"));

        await expect(assertNativeLibraries(context(), { fatal: true, exec })).rejects.toThrow(
            "failed to read ELF headers: Error: Not an ELF file",
        );
    });

    it("fails once if readelf is not installed", async () => {
        const exec = vi
            .fn<Exec>()
            .mockRejectedValue(Object.assign(new Error("spawn readelf ENOENT"), { code: "ENOENT" }));

        await expect(assertNativeLibraries(context(), { fatal: true, exec })).rejects.toThrow(
            "Native library checks failed for linux-x64:\nFailed to check native libraries: Error: spawn readelf ENOENT",
        );
    });

    it("warns instead of failing when not fatal", async () => {
        const warn = vi.spyOn(log, "warn").mockImplementation(() => {});
        const exec = vi.fn<Exec>().mockResolvedValue(readelfOutput({ glibc: ["2.39"] }));

        await expect(assertNativeLibraries(context(), { fatal: false, exec })).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledWith(null, expect.stringContaining("requires GLIBC 2.39"));
    });

    it("is fatal on CI by default", async () => {
        vi.stubEnv("CI", "true");
        const exec = vi.fn<Exec>().mockResolvedValue(readelfOutput({ glibc: ["2.39"] }));

        await expect(assertNativeLibraries(context(), { exec })).rejects.toThrow("requires GLIBC 2.39");
    });
});

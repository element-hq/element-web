/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import * as fsp from "node:fs/promises";
import path from "node:path";
import { type AfterPackContext, Arch, type LinuxPackager, log } from "electron-builder";

import { defaultExec, type Exec } from "./exec.ts";

/**
 * The newest glibc version our Linux binaries may depend on.
 * Ubuntu 22.04 (jammy) (2.35) is the oldest supported distro, Debian bookworm (2.36) and newer are a superset,
 * and the deb declares `libc6 (>= 2.35)` to match. This is deliberately set to the newest version we currently link,
 * 2.34 in the prebuilt Seshat binaries (Electron only links against 2.25), rather than 2.35,
 * so that any increase is noticed. It may be raised as far as 2.35 without dropping support for any distro.
 */
export const MAX_GLIBC = "2.34";

/**
 * Libraries which must not be linked dynamically, the prebuilt seshat binaries statically link sqlcipher & openssl.
 */
const FORBIDDEN_LIBRARIES = ["libcrypto.so", "libsqlcipher.so"];

/**
 * The `Machine` field `readelf` prints for each architecture we build for.
 */
const ELF_MACHINES: Partial<Record<Arch, string>> = {
    [Arch.x64]: "Advanced Micro Devices X86-64",
    [Arch.arm64]: "AArch64",
    [Arch.armv7l]: "ARM",
    [Arch.ia32]: "Intel 80386",
};

/**
 * Options for {@link assertNativeLibraries}.
 */
interface AssertNativeLibrariesOptions {
    /**
     * Whether problems fail the build, otherwise they are logged as a warning. Defaults to failing on CI only, as local
     * builds outside the docker image link against the host's glibc.
     */
    fatal?: boolean;
    /** The newest glibc version the binaries may depend on, defaults to {@link MAX_GLIBC}. */
    maxGlibc?: string;
    /** Runs external commands, overridable for tests. */
    exec?: Exec;
}

/**
 * Compares two dotted version strings numerically.
 * @returns a negative number if `a < b`, zero if equal, a positive number if `a > b`.
 */
function compareVersions(a: string, b: string): number {
    const aParts = a.split(".").map(Number);
    const bParts = b.split(".").map(Number);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

/**
 * Recursively lists the `.node` files in a directory.
 */
async function findNodeModules(dir: string): Promise<string[]> {
    const entries = await fsp.readdir(dir, { recursive: true, withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".node"))
        .map((entry) => path.join(entry.parentPath, entry.name));
}

/**
 * Checks a single ELF binary using `readelf`.
 * @returns the problems found, empty if the binary is fine.
 */
async function checkBinary(file: string, arch: Arch, maxGlibc: string, exec: Exec): Promise<string[]> {
    let output: string;
    try {
        output = await exec("readelf", ["--file-header", "--dynamic", "--version-info", "--wide", file]);
    } catch (e) {
        // readelf itself is missing, e.g. building for Linux on another platform, so no file can be checked
        if ((e as NodeJS.ErrnoException).code === "ENOENT") throw e;
        return [`${file}: failed to read ELF headers: ${e}`];
    }

    const problems: string[] = [];

    const machine = /^\s*Machine:\s*(.+?)\s*$/m.exec(output)?.[1];
    const expectedMachine = ELF_MACHINES[arch];
    if (expectedMachine && machine !== expectedMachine) {
        problems.push(`${file}: built for '${machine}', expected '${expectedMachine}' for ${Arch[arch]}`);
    }

    const needed = [...output.matchAll(/\(NEEDED\)\s+Shared library: \[(.+?)]/g)].map((m) => m[1]);
    for (const library of needed) {
        if (FORBIDDEN_LIBRARIES.some((forbidden) => library.startsWith(forbidden))) {
            problems.push(`${file}: dynamically links ${library}, which should be linked statically`);
        }
    }

    const glibcVersions = new Set([...output.matchAll(/GLIBC_(\d+(?:\.\d+)+)/g)].map((m) => m[1]));
    for (const version of glibcVersions) {
        if (compareVersions(version, maxGlibc) > 0) {
            problems.push(`${file}: requires GLIBC ${version}, which is newer than the supported ${maxGlibc}`);
        }
    }

    return problems;
}

/**
 * Checks the native binaries of a packaged Linux app: every `.node` file and the main executable must be built for
 * the target architecture, must not depend on a newer glibc than our oldest supported distro ships, and must not
 * dynamically link libraries which we expect to be statically linked.
 * Apps packaged for other platforms are ignored.
 * Must run after the binaries for other architectures are pruned, as they would fail the checks.
 * @param context the context of the packaged app.
 * @param options optional overrides.
 */
export async function assertNativeLibraries(
    context: Pick<AfterPackContext, "appOutDir" | "arch" | "electronPlatformName" | "packager">,
    { fatal = Boolean(process.env.CI), maxGlibc = MAX_GLIBC, exec = defaultExec }: AssertNativeLibrariesOptions = {},
): Promise<void> {
    if (context.electronPlatformName !== "linux") return;

    let problems: string[];
    try {
        const executable = path.join(context.appOutDir, (context.packager as LinuxPackager).executableName);
        const files = [...(await findNodeModules(context.appOutDir)), executable];
        problems = (await Promise.all(files.map((file) => checkBinary(file, context.arch, maxGlibc, exec)))).flat();
    } catch (e) {
        problems = [`Failed to check native libraries: ${e}`];
    }
    if (problems.length === 0) return;

    const message = `Native library checks failed for linux-${Arch[context.arch]}:\n${problems.join("\n")}`;
    if (fatal) throw new Error(message);
    log.warn(null, message);
}

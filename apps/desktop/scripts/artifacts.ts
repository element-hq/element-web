/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import * as fsp from "node:fs/promises";
import path from "node:path";
import type { BuildResult } from "electron-builder";

/**
 * A file which must be present in the output directory, as a pattern matched against its path relative to the
 * output directory, using forward slashes.
 */
interface ExpectedArtifact {
    description: string;
    pattern: RegExp;
}

/**
 * The files each target must produce, keyed by electron-builder platform name and then target name.
 * The deploy & test jobs depend on these files being present.
 * The `*` entries apply to every build for that platform.
 */
const EXPECTED_ARTIFACTS: Record<string, Record<string, ExpectedArtifact[]>> = {
    linux: {
        "deb": [{ description: "deb package", pattern: /^[^/]+\.deb$/ }],
        "tar.gz": [{ description: "tar.gz archive", pattern: /^[^/]+\.tar\.gz$/ }],
    },
    mac: {
        dmg: [{ description: "dmg image", pattern: /^[^/]+\.dmg$/ }],
        zip: [{ description: "macOS zip", pattern: /^[^/]+-mac\.zip$/ }],
    },
    windows: {
        "*": [{ description: "unpacked executable", pattern: /^win-(?:[^/]+-)?unpacked\/[^/]+\.exe$/ }],
        "squirrel": [
            { description: "Squirrel installer", pattern: /^squirrel-windows[^/]*\/[^/]+ Setup [^/]+\.exe$/ },
            { description: "Squirrel full nupkg", pattern: /^squirrel-windows[^/]*\/[^/]+-full\.nupkg$/ },
            { description: "Squirrel RELEASES file", pattern: /^squirrel-windows[^/]*\/RELEASES$/ },
        ],
        "msi": [{ description: "MSI installer", pattern: /^[^/]+\.msi$/ }],
    },
};

/**
 * Lists the files in a directory and its immediate subdirectories, relative to it, using forward slashes.
 * Goes no deeper so that it doesn't walk the unpacked app.
 */
async function listOutput(outDir: string): Promise<string[]> {
    const files: string[] = [];
    for (const entry of await fsp.readdir(outDir, { withFileTypes: true })) {
        if (entry.isFile()) {
            files.push(entry.name);
        } else if (entry.isDirectory()) {
            for (const child of await fsp.readdir(path.join(outDir, entry.name), { withFileTypes: true })) {
                if (child.isFile()) files.push(`${entry.name}/${child.name}`);
            }
        }
    }
    return files;
}

/**
 * Fails the build if a target did not produce the files we expect of it, which the deploy & test jobs depend on.
 * @param buildResult the result of the build, giving the output directory and the targets built for each platform.
 */
export async function assertArtifactsPresent(
    buildResult: Pick<BuildResult, "outDir" | "platformToTargets">,
): Promise<void> {
    const files = await listOutput(buildResult.outDir);
    const missing: string[] = [];
    for (const [platform, targets] of buildResult.platformToTargets) {
        const expectations = EXPECTED_ARTIFACTS[platform.name] ?? {};
        for (const target of ["*", ...targets.keys()]) {
            for (const { description, pattern } of expectations[target] ?? []) {
                if (!files.some((file) => pattern.test(file))) {
                    missing.push(`${platform.name} ${target === "*" ? "build" : `${target} target`}: ${description}`);
                }
            }
        }
    }
    if (missing.length > 0) {
        throw new Error(`Build is missing expected artifacts:\n${missing.join("\n")}`);
    }
}

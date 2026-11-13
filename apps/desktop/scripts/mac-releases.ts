/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import * as fsp from "node:fs/promises";
import path from "node:path";
import type { BuildResult } from "electron-builder";

/**
 * Writes the Squirrel.Mac update manifests pointing at the macOS zip built by electron-builder:
 * `releases.json`, and `releases-legacy.json` which holds only the `url` for older clients.
 * Nothing is written unless the build is for macOS and is going to be deployed.
 * @param buildResult the result of the build, giving the output directory, artifacts & platforms built.
 * @param version the version of the build.
 * @param baseUrl the URL the build output will be deployed to, if it is going to be deployed.
 * @returns the paths of the written manifests.
 */
export async function writeMacReleasesJson(
    buildResult: Pick<BuildResult, "outDir" | "artifactPaths" | "platformToTargets">,
    version: string,
    baseUrl: string | undefined,
): Promise<string[]> {
    const isMac = [...buildResult.platformToTargets.keys()].some((platform) => platform.name === "mac");
    if (!baseUrl || !isMac) return [];

    const zips = buildResult.artifactPaths.filter((file) => file.toLowerCase().endsWith("-mac.zip"));
    if (zips.length !== 1) {
        throw new Error(`Expected exactly one macOS zip to generate releases.json for, found ${zips.length}`);
    }

    // Encode spaces in the URL as Squirrel.Mac complains about bad JSON otherwise
    const url = `${baseUrl}/update/macos/${path.basename(zips[0]).replaceAll(" ", "%20")}`;

    const releases = {
        currentRelease: version,
        releases: [{ version, updateTo: { version, url } }],
    };
    const releasesPath = path.join(buildResult.outDir, "releases.json");
    await fsp.writeFile(releasesPath, JSON.stringify(releases, null, 2) + "\n");

    const legacyPath = path.join(buildResult.outDir, "releases-legacy.json");
    await fsp.writeFile(legacyPath, JSON.stringify({ url }, null, 2) + "\n");

    return [releasesPath, legacyPath];
}

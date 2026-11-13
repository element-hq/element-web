/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type ArtifactCreated, log } from "electron-builder";

import { defaultExec, type Exec } from "./exec.ts";

/**
 * The targets whose artifacts are archives that must not contain hard links.
 */
const ARCHIVE_TARGETS = ["deb", "tar.gz"];

/**
 * Lists the hard links in a deb package or tar.gz archive.
 * @returns the `tar -tv` listing lines of the hard links, empty if there are none.
 */
async function findHardLinks(file: string, exec: Exec): Promise<string[]> {
    // dpkg-deb lists the package contents in the same format as `tar -tv`
    const listing = file.endsWith(".deb")
        ? await exec("dpkg-deb", ["--contents", file])
        : await exec("tar", ["-tvzf", file]);
    return listing.split("\n").filter((line) => line.startsWith("h"));
}

/**
 * Fails the build if a deb package or tar.gz archive contains hard links, as they lose their permissions when
 * extracted, see https://github.com/electron-userland/electron-builder/issues/5721.
 * Artifacts of other targets are ignored. Requires `dpkg-deb` for deb packages, the check is skipped with a warning
 * if it is missing, e.g. when building a deb on another platform.
 * @param artifact the artifact electron-builder built.
 * @param exec runs external commands, overridable for tests.
 */
export async function assertNoHardLinks(
    artifact: Pick<ArtifactCreated, "file" | "target">,
    exec: Exec = defaultExec,
): Promise<void> {
    if (!ARCHIVE_TARGETS.includes(artifact.target?.name ?? "")) return;

    let hardLinks: string[];
    try {
        hardLinks = await findHardLinks(artifact.file, exec);
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        log.warn({ file: log.filePath(artifact.file), error: String(e) }, "skipped checking for hard links");
        return;
    }
    if (hardLinks.length > 0) {
        throw new Error(`${artifact.file} contains hard links, which lose their permissions:\n${hardLinks.join("\n")}`);
    }
}

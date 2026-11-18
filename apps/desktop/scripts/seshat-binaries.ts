/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import * as fsp from "node:fs/promises";
import path from "node:path";
import { type AfterPackContext, Arch, log } from "electron-builder";

/**
 * Removes the prebuilt `@matrix-org/seshat` binaries a packaged app doesn't need.
 *
 * The `@matrix-org/seshat` package pulls in a prebuilt binary package per platform+arch as optional dependencies.
 * CI installs more than one of them so that cross-arch builds work, so prune the ones we don't need
 * from the packaged app. We always keep both darwin architectures as electron-builder packs each half
 * of a universal build separately, and @electron/universal requires them to contain the same files.
 * @param context the context of the packaged app.
 */
export async function pruneSeshatBinaries(
    context: Pick<AfterPackContext, "appOutDir" | "arch" | "electronPlatformName" | "packager">,
): Promise<void> {
    const platform = context.electronPlatformName;
    const arch = Arch[context.arch];
    const keep = platform === "darwin" ? /^seshat-darwin-/ : new RegExp(`^seshat-${platform}-${arch}$`);

    const modulesDir = path.join(
        context.packager.getResourcesDir(context.appOutDir),
        "app.asar.unpacked",
        "node_modules",
        "@matrix-org",
    );
    let entries: string[];
    try {
        entries = await fsp.readdir(modulesDir);
    } catch {
        return; // No unpacked seshat binaries in this build
    }
    for (const entry of entries) {
        if (entry.startsWith("seshat-") && !keep.test(entry)) {
            log.info({ module: entry, platform, arch }, "pruning unneeded seshat binary");
            await fsp.rm(path.join(modulesDir, entry), { recursive: true, force: true });
        }
    }
}

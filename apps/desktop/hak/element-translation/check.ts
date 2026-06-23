/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fsProm from "node:fs/promises";
import path from "node:path";

import type HakEnv from "../../scripts/hak/hakEnv.ts";
import type { DependencyInfo } from "../../scripts/hak/dep.ts";

export default async function (hakEnv: HakEnv, moduleInfo: DependencyInfo): Promise<void> {
    // This is an in-repo native module, so there is no npm package to fetch. We stage the
    // source into the build dir here (check runs before fetch); hak's default `fetch` step
    // then no-ops because the build dir already exists.
    const srcDir = path.join(moduleInfo.moduleHakDir, "native");
    await fsProm.cp(srcDir, moduleInfo.moduleBuildDir, { recursive: true });

    // The native addon is macOS-only; nothing more to check on other platforms.
    if (!hakEnv.isMac()) return;

    try {
        // node-gyp needs python; try python3 first for a clearer error.
        await hakEnv.checkTools([["python3", "--version"]]);
    } catch {
        await hakEnv.checkTools([["python", "--version"]]);
    }
}

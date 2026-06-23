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
    // Stage the loader + package manifest into the output module on every platform so it can
    // be linked and imported. The native .node binary is macOS-only and is copied separately
    // via hak.json's `copy` (kept binary-only so universal builds can lipo it).
    const srcDir = path.join(moduleInfo.moduleHakDir, "native");
    await fsProm.mkdir(moduleInfo.moduleOutDir, { recursive: true });
    await fsProm.copyFile(path.join(srcDir, "package.json"), path.join(moduleInfo.moduleOutDir, "package.json"));
    await fsProm.copyFile(path.join(srcDir, "index.cjs"), path.join(moduleInfo.moduleOutDir, "index.cjs"));

    // macOS-only native addon. On other platforms the stub loader reports translation as
    // unavailable at runtime.
    if (!hakEnv.isMac()) return;

    // makeGypEnv sets npm_config_arch / npm_config_target / npm_config_runtime so node-gyp
    // builds against the correct Electron ABI and architecture.
    const env = hakEnv.makeGypEnv();

    // This is a standalone package (no pnpm workspace linkage), so we use npm to pull in the
    // declared node-gyp and then run the build against the Electron headers.
    console.log("Installing element-translation build dependencies");
    await hakEnv.spawn("npm", ["install", "--no-audit", "--no-fund"], {
        cwd: moduleInfo.moduleBuildDir,
        env,
        shell: true,
    });

    console.log("Building element-translation native addon");
    await hakEnv.spawn("npm", ["run", "build"], {
        cwd: moduleInfo.moduleBuildDir,
        env,
        shell: true,
    });
}

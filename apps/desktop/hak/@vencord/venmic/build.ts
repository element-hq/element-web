/*
Copyright 2026 Joao Costa <me@joaocosta.dev>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import path from "node:path";
import fsProm from "node:fs/promises";

import type HakEnv from "../../../scripts/hak/hakEnv.js";
import type { DependencyInfo } from "../../../scripts/hak/dep.js";

export default async function (hakEnv: HakEnv, moduleInfo: DependencyInfo): Promise<void> {
    // venmic is Linux-only
    if (!hakEnv.isLinux()) {
        console.log("Skipping venmic build: not targeting Linux");
        return;
    }

    const arch = hakEnv.getTargetArch();

    // venmic only has x64 and arm64 prebuilds
    if (arch !== "x64" && arch !== "arm64") {
        console.log(`Skipping venmic build: no prebuild for architecture ${arch}`);
        return;
    }

    const venmicSource = path.join(
        hakEnv.projectRoot,
        "node_modules",
        "@vencord",
        "venmic",
        "prebuilds",
        `venmic-addon-linux-${arch}`,
        "node-napi-v7.node",
    );

    // Check if venmic is installed (it's optional)
    try {
        await fsProm.access(venmicSource);
    } catch {
        console.log("venmic prebuilds not found, skipping (optional dependency)");
        return;
    }

    // Ensure build directory exists
    await fsProm.mkdir(moduleInfo.moduleBuildDir, { recursive: true });

    // Copy prebuild to build dir
    const dest = path.join(moduleInfo.moduleBuildDir, "venmic.node");
    await fsProm.copyFile(venmicSource, dest);
    console.log(`Copied venmic ${arch} prebuild to ${dest}`);
}

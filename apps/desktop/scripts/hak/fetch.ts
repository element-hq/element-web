/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fsProm from "node:fs/promises";
import pacote from "pacote";
import path from "node:path";

import type HakEnv from "./hakEnv.js";
import type { DependencyInfo } from "./dep.js";

export default async function fetch(hakEnv: HakEnv, moduleInfo: DependencyInfo): Promise<void> {
    let haveModuleBuildDir;
    try {
        const stats = await fsProm.stat(moduleInfo.moduleBuildDir);
        haveModuleBuildDir = stats.isDirectory();
    } catch {
        haveModuleBuildDir = false;
    }

    if (haveModuleBuildDir) return;

    console.log("Fetching " + moduleInfo.name + "@" + moduleInfo.version);

    const packumentCache = new Map();
    await pacote.extract(`${moduleInfo.name}@${moduleInfo.version}`, moduleInfo.moduleBuildDir, {
        packumentCache,
    });

    // Workaround for us switching to pnpm but matrix-seshat still using yarn classic
    const packageJsonPath = path.join(moduleInfo.moduleBuildDir, "package.json");
    const packageJson = await fsProm.readFile(packageJsonPath, "utf-8");
    const packageJsonData = JSON.parse(packageJson);
    packageJsonData["packageManager"] = "yarn@1.22.22";
    await fsProm.writeFile(packageJsonPath, JSON.stringify(packageJsonData, null, 2), "utf-8");

    console.log("Running yarn install in " + moduleInfo.moduleBuildDir);
    await hakEnv.spawn("yarn", ["install", "--ignore-scripts"], {
        cwd: moduleInfo.moduleBuildDir,
    });

    // also extract another copy to the output directory at this point
    // nb. we do not yarn install in the output copy: we could install in
    // production mode to get only runtime dependencies and not devDependencies,
    // but usually native modules come with dependencies that are needed for
    // building/fetching the native modules (eg. node-pre-gyp) rather than
    // actually used at runtime: we do not want to bundle these into our app.
    // We therefore just install no dependencies at all, and accept that any
    // actual runtime dependencies will have to be added to the main app's
    // dependencies. We can't tell what dependencies are real runtime deps
    // and which are just used for native module building.
    await pacote.extract(`${moduleInfo.name}@${moduleInfo.version}`, moduleInfo.moduleOutDir, {
        packumentCache,
    });
}

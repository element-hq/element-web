/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type HakEnv from "../../scripts/hak/hakEnv.ts";
import type { DependencyInfo } from "../../scripts/hak/dep.ts";

export default async function (hakEnv: HakEnv, moduleInfo: DependencyInfo): Promise<void> {
    const env = hakEnv.makeGypEnv();

    if (!hakEnv.isHost()) {
        env.CARGO_BUILD_TARGET = hakEnv.getTargetId();
    }

    const sqlcipherVariant = hakEnv.wantsStaticSqlCipher() ? "static" : "dynamic";

    // Via the package's own `download` script rather than invoking its
    // underlying file directly, since that file's name/invocation is an
    // implementation detail that can change between published versions —
    // the npm script name is the stable contract. It has no dependencies of
    // its own, so this can run before `yarn install` — if it finds a
    // matching prebuilt we skip installing/building from source entirely.
    console.log(
        `Trying prebuilt matrix-seshat (${hakEnv.target.platform}-${hakEnv.target.arch}, ${sqlcipherVariant} sqlcipher)`,
    );
    try {
        const downloadArgs = [
            "run",
            "download",
            `--platform=${hakEnv.target.platform}`,
            `--arch=${hakEnv.target.arch}`,
            `--sqlcipher=${sqlcipherVariant}`,
            "--no-fallback",
        ];
        // Raises the GitHub API rate limit for the release lookup from
        // 60/hour to 5000/hour — matters in CI, where many workflows share
        // a small pool of runner IPs against the unauthenticated limit.
        if (process.env.GITHUB_TOKEN) {
            downloadArgs.push(`--token=${process.env.GITHUB_TOKEN}`);
        }
        await hakEnv.spawn("yarn", downloadArgs, {
            cwd: moduleInfo.moduleBuildDir,
            env,
            shell: true,
        });
        console.log("Using prebuilt matrix-seshat, skipping build from source");
        return;
    } catch {
        console.log("No prebuilt matrix-seshat available, building from source");
    }

    console.log("Running yarn install");
    await hakEnv.spawn("yarn", ["install", "--ignore-scripts"], {
        cwd: moduleInfo.moduleBuildDir,
        env,
        shell: true,
    });

    const buildTarget = sqlcipherVariant === "static" ? "build-bundled" : "build";

    console.log("Running yarn build");
    await hakEnv.spawn("yarn", ["run", buildTarget], {
        cwd: moduleInfo.moduleBuildDir,
        env,
        shell: true,
    });
}

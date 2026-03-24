/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type HakEnv from "./hakEnv.js";

export interface DependencyInfo {
    name: string;
    version: string;
    cfg: Record<string, any>;
    moduleHakDir: string;
    moduleDotHakDir: string;
    moduleTargetDotHakDir: string;
    moduleBuildDir: string;
    moduleBuildDirs: string[];
    moduleOutDir: string;
    nodeModuleBinDir: string;
    depPrefix: string;
    scripts: Record<string, (hakEnv: HakEnv, moduleInfo: DependencyInfo) => Promise<void>>;
}

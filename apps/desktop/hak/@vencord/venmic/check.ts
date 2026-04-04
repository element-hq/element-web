/*
Copyright 2026 Joao Costa <me@joaocosta.dev>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type HakEnv from "../../../scripts/hak/hakEnv.js";
import type { DependencyInfo } from "../../../scripts/hak/dep.js";

export default async function (hakEnv: HakEnv, moduleInfo: DependencyInfo): Promise<void> {
    // venmic is Linux-only
    if (!hakEnv.isLinux()) {
        console.log(`Skipping venmic: only supported on Linux (target: ${hakEnv.getTargetId()})`);
        return;
    }

    // venmic only provides x64 and arm64 prebuilds
    const arch = hakEnv.getTargetArch();
    if (arch !== "x64" && arch !== "arm64") {
        throw new Error(`venmic does not provide prebuilds for architecture: ${arch}`);
    }
}

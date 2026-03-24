/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type HakEnv from "./hakEnv.js";
import { type DependencyInfo } from "./dep.js";

export default async function link(hakEnv: HakEnv, moduleInfo: DependencyInfo): Promise<void> {
    await hakEnv.spawn("pnpm", ["link", moduleInfo.moduleOutDir], {
        cwd: hakEnv.projectRoot,
    });
}

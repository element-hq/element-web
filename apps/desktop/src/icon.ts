/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import path from "node:path";

import { getAsarPath } from "./asar.js";

export async function getIconPath(): Promise<string> {
    const asarPath = await getAsarPath();

    const iconFile = `icon.${process.platform === "win32" ? "ico" : "png"}`;
    return path.join(path.dirname(asarPath), "build", iconFile);
}

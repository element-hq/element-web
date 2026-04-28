/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { tryPaths } from "./utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let asarPathPromise: Promise<string> | undefined;
// Get the webapp resource file path, memoizes result
export function getAsarPath(): Promise<string> {
    if (!asarPathPromise) {
        asarPathPromise = tryPaths("webapp", __dirname, [
            // If run from the source checkout, this will be in the directory above
            "../webapp.asar",
            // but if run from a packaged application, electron-main.js will be in
            // a different asar file, so it will be two levels above
            "../../webapp.asar",
            // also try without the 'asar' suffix to allow symlinking in a directory
            "../webapp",
            // from a packaged application
            "../../webapp",
        ]);
    }

    return asarPathPromise;
}

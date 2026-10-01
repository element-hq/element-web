#!/usr/bin/env node
/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/*
 * Checks for the presence of a webapp, inspects its version and prints it
 */

import url from "node:url";

import { versionFromAsar } from "./set-version.ts";

async function main(): Promise<number> {
    const version = await versionFromAsar();
    console.log(version);

    return 0;
}

if (import.meta.url.startsWith("file:")) {
    const modulePath = url.fileURLToPath(import.meta.url);
    if (process.argv[1] === modulePath) {
        main()
            .then((ret) => {
                process.exit(ret);
            })
            .catch((e) => {
                console.error(e);
                process.exit(1);
            });
    }
}

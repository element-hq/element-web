/*
Copyright 2024 New Vector Ltd.
Copyright 2017 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import path from "node:path";
import { spawn } from "node:child_process";
import { app } from "electron";

export function getSquirrelExecutable(): string {
    return path.resolve(path.dirname(process.execPath), "..", "Update.exe");
}

function runUpdateExe(args: string[]): Promise<void> {
    // Invokes Squirrel's Update.exe which will do things for us like create shortcuts
    // Note that there's an Update.exe in the app-x.x.x directory and one in the parent
    // directory: we need to run the one in the parent directory, because it discovers
    // information about the app by inspecting the directory it's run from.
    const updateExe = getSquirrelExecutable();
    console.log(`Spawning '${updateExe}' with args '${args}'`);
    return new Promise((resolve) => {
        spawn(updateExe, args, {
            detached: true,
        }).on("close", resolve);
    });
}

function checkSquirrelHooks(): boolean {
    if (process.platform !== "win32") return false;
    const cmd = process.argv[1];
    const target = path.basename(process.execPath);

    switch (cmd) {
        case "--squirrel-install":
            void runUpdateExe(["--createShortcut=" + target]).then(() => app.quit());
            return true;

        case "--squirrel-updated":
        case "--squirrel-obsolete":
            app.quit();
            return true;

        case "--squirrel-uninstall":
            void runUpdateExe(["--removeShortcut=" + target]).then(() => app.quit());
            return true;

        default:
            return false;
    }
}

if (checkSquirrelHooks()) {
    process.exit(1);
}

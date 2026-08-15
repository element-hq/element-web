/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
    console.log("Skipping the Windows screen-share audio helper build on this platform.");
} else {
    const directory = path.dirname(fileURLToPath(import.meta.url));
    const result = spawnSync(
        "powershell.exe",
        [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            path.join(directory, "build.ps1"),
        ],
        { stdio: "inherit", windowsHide: true },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error("Screen-share audio helper build failed");
}

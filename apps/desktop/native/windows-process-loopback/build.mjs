/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
    console.log("Skipping the Windows screen-share audio helper build on this platform.");
} else {
    const directory = path.dirname(fileURLToPath(import.meta.url));
    const systemRoot = process.env.SystemRoot ?? process.env.WINDIR;
    if (!systemRoot || !path.isAbsolute(systemRoot)) {
        throw new Error("An absolute Windows system root is required to build the screen-share audio helper");
    }
    const powershell = path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    if (!fs.existsSync(powershell)) {
        throw new Error("Windows PowerShell was not found at the expected system path");
    }
    const result = spawnSync(
        powershell,
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

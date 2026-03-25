/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import childProcess from "node:child_process";
import fsProm from "node:fs/promises";

import type HakEnv from "../../scripts/hak/hakEnv.js";
import type { Tool } from "../../scripts/hak/hakEnv.js";
import type { DependencyInfo } from "../../scripts/hak/dep.js";

export default async function (hakEnv: HakEnv, moduleInfo: DependencyInfo): Promise<void> {
    const tools: Tool[] = [
        ["rustc", "--version"],
        ["python", "--version"], // node-gyp uses python for reasons beyond comprehension
    ];
    if (hakEnv.isWin()) {
        tools.push(["perl", "--version"]); // for openssl configure
        tools.push(["nasm", "-v"]); // for openssl building
        tools.push(["patch", "--version"]); // to patch sqlcipher Makefile.msc
        tools.push(["nmake", "/?"]);
    } else {
        tools.push(["make", "--version"]);
    }
    await hakEnv.checkTools(tools);

    // Ensure Rust target exists (nb. we avoid depending on rustup)
    await new Promise((resolve, reject) => {
        const rustc = childProcess.execFile(
            "rustc",
            ["--target", hakEnv.getTargetId(), "--emit=obj", "-o", "tmp", "-"],
            (err, out) => {
                if (err) {
                    reject(
                        "rustc can't build for target " +
                            hakEnv.getTargetId() +
                            ": ensure target is installed via `rustup target add " +
                            hakEnv.getTargetId() +
                            "` " +
                            "or your package manager if not using `rustup`",
                    );
                }
                fsProm.unlink("tmp").then(resolve);
            },
        );
        rustc.stdin!.write("fn main() {}");
        rustc.stdout!.pipe(process.stdout);
        rustc.stderr!.pipe(process.stderr);
        rustc.stdin!.end();
    });
}

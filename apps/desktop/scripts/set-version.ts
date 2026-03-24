#!/usr/bin/env -S npx tsx

/*
 * Checks for the presence of a webapp, inspects its version and sets the
 * version metadata of the package to match.
 */

import { promises as fs } from "node:fs";
import * as asar from "@electron/asar";
import * as childProcess from "node:child_process";
import * as url from "node:url";

export async function versionFromAsar(): Promise<string> {
    try {
        await fs.stat("webapp.asar");
    } catch {
        throw new Error("No 'webapp.asar' found. Run 'pnpm run fetch'");
    }

    return asar.extractFile("webapp.asar", "version").toString().trim();
}

export async function setPackageVersion(ver: string): Promise<void> {
    // set version in package.json: electron-builder will use this to populate
    // all the various version fields
    await new Promise<void>((resolve, reject) => {
        childProcess.execFile(
            process.platform === "win32" ? "pnpm.cmd" : "pnpm",
            [
                "version",
                "-s",
                "--no-git-tag-version", // This also means "don't commit to git" as it turns out
                "--new-version",
                ver,
            ],
            {
                // We need shell mode on Windows to be able to launch `.cmd` executables
                // See https://nodejs.org/en/blog/vulnerability/april-2024-security-releases-2
                shell: process.platform === "win32",
            },
            (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            },
        );
    });
}

async function main(args: string[]): Promise<number> {
    let version = args[0];

    if (version === undefined) version = await versionFromAsar();

    await setPackageVersion(version);
    return 0;
}

if (import.meta.url.startsWith("file:")) {
    const modulePath = url.fileURLToPath(import.meta.url);
    if (process.argv[1] === modulePath) {
        main(process.argv.slice(2))
            .then((ret) => {
                process.exit(ret);
            })
            .catch((e) => {
                console.error(e);
                process.exit(1);
            });
    }
}

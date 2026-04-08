/*
Copyright 2022-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import afs from "node:fs/promises";

export async function randomArray(size: number): Promise<string> {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(size, (err, buf) => {
            if (err) {
                reject(err);
            } else {
                resolve(buf.toString("base64").replace(/=+$/g, ""));
            }
        });
    });
}

type JsonValue = null | string | number;
type JsonArray = Array<JsonValue | JsonObject | JsonArray>;
export interface JsonObject {
    [key: string]: JsonObject | JsonArray | JsonValue;
}
export type Json = JsonArray | JsonObject;

/**
 * Synchronously load a JSON file from the local filesystem.
 * Unlike `require`, will never execute any javascript in a loaded file.
 * @param paths - An array of path segments which will be joined using the system's path delimiter.
 */
export function loadJsonFile<T extends Json>(...paths: string[]): T {
    const joinedPaths = path.join(...paths);

    if (!fs.existsSync(joinedPaths)) {
        console.log(`Skipping nonexistent file: ${joinedPaths}`);
        return {} as T;
    }

    const file = fs.readFileSync(joinedPaths, { encoding: "utf-8" });
    return JSON.parse(file);
}

/**
 * Looks for a given path relative to root
 * @param name - dir name to use in logging
 * @param root - the root to search from
 * @param rawPaths - the paths to search, in order
 */
export async function tryPaths(name: string, root: string, rawPaths: string[]): Promise<string> {
    // Make everything relative to root
    const paths = rawPaths.map((p) => path.join(root, p));

    for (const p of paths) {
        try {
            await afs.stat(p);
            return p + "/";
        } catch {}
    }
    console.log(`Couldn't find ${name} files in any of: `);
    for (const p of paths) {
        console.log("\t" + path.resolve(p));
    }
    throw new Error(`Failed to find ${name} files`);
}

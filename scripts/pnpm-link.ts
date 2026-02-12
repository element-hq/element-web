#!/usr/bin/env node

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Utility script to mimic yarn classic `link` behaviour
// to enable rapid development of libraries like matrix-js-sdk using symlinks/directory junctions
// reads .link-config file for DEPENDENCY=PATH values and removes those dependencies from node_modules,
// replacing them with a symlink/directory junction.
// This tool is a helpful substitute to `pnpm link` as that modifies the package.json & pnpm-lock.yaml files.

import fs from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "..", ".link-config");
const nodeModulesPath = join(__dirname, "..", "node_modules");

try {
    const configFile = await fs.readFile(configPath, "utf-8");
    for (const line of configFile.trim().split("\n")) {
        const [dependency, path] = line.split("=");
        const dependencyPath = join(nodeModulesPath, dependency);

        try {
            const stat = await fs.stat(dependencyPath);
            if (stat.isSymbolicLink()) {
                const linkPath = await fs.readlink(dependencyPath);
                if (linkPath === path) {
                    // already done
                    continue;
                } else {
                    await fs.unlink(dependencyPath);
                }
            } else {
                await fs.rm(dependencyPath, { recursive: true });
            }

            console.log(`Linking ${dependency} to ${path}`);
            await fs.symlink(path, dependencyPath);

            // pnpm install may have wiped out the `node_modules` dir so we have to restore it
            execSync("pnpm i --ignore-scripts --frozen-lockfile", {
                cwd: dependencyPath,
            });
        } catch (e) {
            console.error(`Failed to link ${dependency}`, e);
        }
    }
} catch {
    // Ignore config file not existing
}

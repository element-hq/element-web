/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import HakEnv from "./hakEnv.js";
import type { TargetId } from "./target.js";
import type { DependencyInfo } from "./dep.js";
import { loadJsonFile } from "../../src/utils.js";
import packageJson from "../../package.json";

// These can only be run on specific modules
const MODULECOMMANDS = ["check", "fetch", "link", "build", "copy", "clean"];

// Shortcuts for multiple commands at once (useful for building universal binaries
// because you can run the fetch/build for each arch and then copy/link once)
const METACOMMANDS: Record<string, string[]> = {
    fetchandbuild: ["check", "fetch", "build"],
    copyandlink: ["copy", "link"],
};

// Scripts valid in a hak.json 'scripts' section
const HAKSCRIPTS = ["check", "fetch", "build"];

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
    const prefix = path.join(__dirname, "..", "..");

    const targetIds: TargetId[] = [];
    // Apply `--target <target>` option if specified
    // Can be specified multiple times for the copy command to bundle
    // multiple arches into a single universal output module)
    for (;;) {
        // eslint-disable-line no-constant-condition
        const targetIndex = process.argv.indexOf("--target");
        if (targetIndex === -1) break;

        if (targetIndex + 1 >= process.argv.length) {
            console.error("--target option specified without a target");
            process.exit(1);
        }
        // Extract target ID and remove from args
        targetIds.push(process.argv.splice(targetIndex, 2)[1] as TargetId);
    }

    const hakEnvs = targetIds.map((tid) => new HakEnv(prefix, tid));
    if (hakEnvs.length == 0) hakEnvs.push(new HakEnv(prefix, null));
    for (const h of hakEnvs) {
        await h.init();
    }
    const hakEnv = hakEnvs[0];

    const deps: Record<string, DependencyInfo> = {};

    const hakDepsCfg = packageJson.hakDependencies || {};

    for (const dep in hakDepsCfg) {
        const hakJsonPath = path.join(prefix, "hak", dep, "hak.json");
        let hakJson: Record<string, any>;
        try {
            hakJson = loadJsonFile(hakJsonPath);
        } catch {
            console.error("No hak.json found for " + dep + ".");
            console.log("Expecting " + hakJsonPath);
            process.exit(1);
        }
        deps[dep] = {
            name: dep,
            version: hakDepsCfg[dep as keyof typeof hakDepsCfg],
            cfg: hakJson,
            moduleHakDir: path.join(prefix, "hak", dep),
            moduleDotHakDir: path.join(hakEnv.dotHakDir, dep),
            moduleTargetDotHakDir: path.join(hakEnv.dotHakDir, dep, hakEnv.getTargetId()),
            moduleBuildDir: path.join(hakEnv.dotHakDir, dep, hakEnv.getTargetId(), "build"),
            moduleBuildDirs: hakEnvs.map((h) => path.join(h.dotHakDir, dep, h.getTargetId(), "build")),
            moduleOutDir: path.join(hakEnv.dotHakDir, "hakModules", dep),
            nodeModuleBinDir: path.join(hakEnv.dotHakDir, dep, hakEnv.getTargetId(), "build", "node_modules", ".bin"),
            depPrefix: path.join(hakEnv.dotHakDir, dep, hakEnv.getTargetId(), "opt"),
            scripts: {},
        };

        for (const s of HAKSCRIPTS) {
            if (hakJson.scripts?.[s]) {
                // Shockingly, using path.join and backslashes here doesn't work on Windows
                const scriptModule = await import(`../../hak/${dep}/${hakJson.scripts[s]}`);
                if (scriptModule.default) {
                    deps[dep].scripts[s] = scriptModule.default;
                } else {
                    deps[dep].scripts[s] = scriptModule;
                }
            }
        }
    }

    let cmds: string[];
    if (process.argv.length < 3) {
        cmds = ["check", "fetch", "build", "copy", "link"];
    } else if (METACOMMANDS[process.argv[2]]) {
        cmds = METACOMMANDS[process.argv[2]];
    } else {
        cmds = [process.argv[2]];
    }

    if (hakEnvs.length > 1 && cmds.some((c) => !["copy", "link"].includes(c))) {
        // We allow link here too for convenience because it's completely arch independent
        console.error("Multiple targets only supported with the copy command");
        return;
    }

    let modules = process.argv.slice(3);
    if (modules.length === 0) modules = Object.keys(deps);

    for (const cmd of cmds) {
        if (!MODULECOMMANDS.includes(cmd)) {
            console.error("Unknown command: " + cmd);
            console.log("Commands I know about:");
            for (const cmd of MODULECOMMANDS) {
                console.log("\t" + cmd);
            }
            process.exit(1);
        }

        const cmdFunc = (await import("./" + cmd)).default;

        for (const mod of modules) {
            const depInfo = deps[mod];
            if (depInfo === undefined) {
                console.log("Module " + mod + " not found - is it in hakDependencies " + "in your package.json?");
                process.exit(1);
            }
            console.log("hak " + cmd + ": " + mod);
            await cmdFunc(hakEnv, depInfo);
        }
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

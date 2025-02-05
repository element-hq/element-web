/*
Copyright 2022-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import * as fs from "fs";
import * as childProcess from "child_process";
import * as semver from "semver";

import { type BuildConfig } from "./BuildConfig";

// This expects to be run from ./scripts/install.ts

const moduleApiDepName = "@matrix-org/react-sdk-module-api";

const MODULES_TS_HEADER = `
/*
 * THIS FILE IS AUTO-GENERATED
 * You can edit it you like, but your changes will be overwritten,
 * so you'd just be trying to swim upstream like a salmon.
 * You are not a salmon.
 */

`;
const MODULES_TS_DEFINITIONS = `
export const INSTALLED_MODULES = [];
`;

export function installer(config: BuildConfig): void {
    if (!config.modules?.length) {
        // nothing to do
        writeModulesTs(MODULES_TS_HEADER + MODULES_TS_DEFINITIONS);
        return;
    }

    let exitCode = 0;

    // We cheat a bit and store the current package.json and lockfile so we can safely
    // run `yarn add` without creating extra committed files for people. We restore
    // these files by simply overwriting them when we're done.
    const packageDeps = readCurrentPackageDetails();

    // Record which optional dependencies there are currently, if any, so we can exclude
    // them from our "must be a module" assumption later on.
    const currentOptDeps = getOptionalDepNames(packageDeps.packageJson);

    try {
        // Install the modules with yarn
        const yarnAddRef = config.modules.join(" ");
        callYarnAdd(yarnAddRef); // install them all at once

        // Grab the optional dependencies again and exclude what was there already. Everything
        // else must be a module, we assume.
        const pkgJsonStr = fs.readFileSync("./package.json", "utf-8");
        const optionalDepNames = getOptionalDepNames(pkgJsonStr);
        const installedModules = optionalDepNames.filter((d) => !currentOptDeps.includes(d));

        // Ensure all the modules are compatible. We check them all and report at the end to
        // try and save the user some time debugging this sort of failure.
        const ourApiVersion = getTopLevelDependencyVersion(moduleApiDepName);
        const incompatibleNames: string[] = [];
        for (const moduleName of installedModules) {
            const modApiVersion = getModuleApiVersionFor(moduleName);
            if (!isModuleVersionCompatible(ourApiVersion, modApiVersion)) {
                incompatibleNames.push(moduleName);
            }
        }
        if (incompatibleNames.length > 0) {
            console.error(
                "The following modules are not compatible with this version of element-web. Please update the module " +
                    "references and try again.",
                JSON.stringify(incompatibleNames, null, 4), // stringify to get prettier/complete output
            );
            exitCode = 1;
            return; // hit the finally{} block before exiting
        }

        // If we reach here, everything seems fine. Write modules.js and log some output
        // Note: we compile modules.js in two parts for developer friendliness if they
        // happen to look at it.
        console.log("The following modules have been installed: ", installedModules);
        let modulesTsHeader = MODULES_TS_HEADER;
        let modulesTsDefs = MODULES_TS_DEFINITIONS;
        let index = 0;
        for (const moduleName of installedModules) {
            const importName = `Module${++index}`;
            modulesTsHeader += `import ${importName} from "${moduleName}";\n`;
            modulesTsDefs += `INSTALLED_MODULES.push(${importName});\n`;
        }
        writeModulesTs(modulesTsHeader + modulesTsDefs);
        console.log("Done installing modules");
    } finally {
        // Always restore package details (or at least try to)
        writePackageDetails(packageDeps);

        if (exitCode > 0) {
            process.exit(exitCode);
        }
    }
}

type RawDependencies = {
    lockfile: string;
    packageJson: string;
};

function readCurrentPackageDetails(): RawDependencies {
    return {
        lockfile: fs.readFileSync("./yarn.lock", "utf-8"),
        packageJson: fs.readFileSync("./package.json", "utf-8"),
    };
}

function writePackageDetails(deps: RawDependencies): void {
    fs.writeFileSync("./yarn.lock", deps.lockfile, "utf-8");
    fs.writeFileSync("./package.json", deps.packageJson, "utf-8");
}

function callYarnAdd(dep: string): void {
    // Add the module to the optional dependencies section just in case something
    // goes wrong in restoring the original package details.
    childProcess.execSync(`yarn add -O ${dep}`, {
        env: process.env,
        stdio: ["inherit", "inherit", "inherit"],
    });
}

function getOptionalDepNames(pkgJsonStr: string): string[] {
    return Object.keys(JSON.parse(pkgJsonStr)?.["optionalDependencies"] ?? {});
}

function findDepVersionInPackageJson(dep: string, pkgJsonStr: string): string {
    const pkgJson = JSON.parse(pkgJsonStr);
    const packages = {
        ...(pkgJson["optionalDependencies"] ?? {}),
        ...(pkgJson["devDependencies"] ?? {}),
        ...(pkgJson["dependencies"] ?? {}),
    };
    return packages[dep];
}

function getTopLevelDependencyVersion(dep: string): string {
    const dependencyTree = JSON.parse(
        childProcess
            .execSync(`npm list ${dep} --depth=0 --json`, {
                env: process.env,
                stdio: ["inherit", "pipe", "pipe"],
            })
            .toString("utf-8"),
    );

    /*
        What a dependency tree looks like:
        {
          "version": "1.10.13",
          "name": "element-web",
          "dependencies": {
            "@matrix-org/react-sdk-module-api": {
              "version": "0.0.1",
              "resolved": "file:../../../matrix-react-sdk-module-api"
            }
          }
        }
     */

    return dependencyTree["dependencies"][dep]["version"];
}

function getModuleApiVersionFor(moduleName: string): string {
    // We'll just pretend that this isn't highly problematic...
    // Yarn is fairly stable in putting modules in a flat hierarchy, at least.
    const pkgJsonStr = fs.readFileSync(`./node_modules/${moduleName}/package.json`, "utf-8");
    return findDepVersionInPackageJson(moduleApiDepName, pkgJsonStr);
}

// A list of Module API versions that are supported in addition to the currently installed one
// defined in the package.json. This is necessary because semantic versioning is applied to both
// the Module-side surface of the API and the Client-side surface of the API. So breaking changes
// in the Client-side surface lead to a major bump even though the Module-side surface stays
// compatible. We aim to not break the Module-side surface so we maintain a list of compatible
// older versions.
const backwardsCompatibleMajorVersions = ["1.0.0"];

function isModuleVersionCompatible(ourApiVersion: string, moduleApiVersion: string): boolean {
    if (!moduleApiVersion) return false;
    return (
        semver.satisfies(ourApiVersion, moduleApiVersion) ||
        backwardsCompatibleMajorVersions.some((version) => semver.satisfies(version, moduleApiVersion))
    );
}

function writeModulesTs(content: string): void {
    fs.writeFileSync("./src/modules.js", content, "utf-8");
}

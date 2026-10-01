/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import minimist, { type ParsedArgs } from "minimist";
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

import { Mode } from "./store.js";
import type ProtocolHandler from "./protocol.js";

const defaultUserDataDir = app.getPath("userData");

/**
 * Calculates the command line arguments to include in the protocol registration,
 * some parameters, e.g. '--hidden' are omitted as it'd cause the app to not be focused.
 * Excludes all positional arguments as those are only relevant once, e.g. for OIDC auth callbacks.
 * Includes unknown parameters as they are sometimes handled by Electron, e.g. `--proxy`.
 * @param parsedArgs - the args the application was started with
 */
export function getArgsForProtocolRegistration(parsedArgs: Args): string[] {
    const args: string[] = [];

    if (!parsedArgs.update) {
        args.push("--no-update");
    }

    if (parsedArgs.localConfigPath) {
        args.push("--config", parsedArgs.localConfigPath);
    }

    if (parsedArgs.userDataPath != defaultUserDataDir) {
        args.push("--profile-dir", parsedArgs.userDataPath);
    }

    return args;
}

/**
 * Element Desktop launch args, returned by {@link getArgs}
 */
export interface Args {
    /**
     * Path to user data, root of all persistent data for this profile.
     */
    userDataPath: string;
    /**
     * Path to local override config.json file.
     */
    localConfigPath?: string;
    /**
     * The store {@link Mode} to use.
     */
    storageMode?: Mode;
    /**
     * Whether to install devtools.
     */
    devtools: boolean;
    /**
     * Whether to start the auto-updater.
     */
    update: boolean;
    /**
     * Whether to start the app hidden.
     */
    hidden: boolean;
    /**
     * Additional positional arguments found.
     */
    positional: string[];
}

/**
 * Electron creates the user data directory (with just an empty 'Dictionaries' directory...)
 * as soon as the app path is set, so pick a random path in it that must exist if it's a
 * real user data directory.
 */
function isRealUserDataDir(d: string): boolean {
    return fs.existsSync(path.join(d, "IndexedDB"));
}

function getUserDataPath(argv: ParsedArgs, protocolHandler: ProtocolHandler): string {
    // check if we are passed a profile in the SSO callback url
    const userDataPathInProtocol = protocolHandler.getProfileFromDeeplink(argv["_"]);
    if (userDataPathInProtocol) {
        return userDataPathInProtocol;
    }

    if (argv["profile-dir"]) {
        return argv["profile-dir"];
    }

    let newUserDataPath = process.env.ELEMENT_PROFILE_DIR ?? defaultUserDataDir;
    if (argv["profile"]) {
        newUserDataPath += "-" + argv["profile"];
    }

    const newUserDataPathExists = isRealUserDataDir(newUserDataPath);
    let oldUserDataPath = path.join(app.getPath("appData"), app.getName().replace("Element", "Riot"));
    if (argv["profile"]) {
        oldUserDataPath += "-" + argv["profile"];
    }

    const oldUserDataPathExists = isRealUserDataDir(oldUserDataPath);
    console.log(`${newUserDataPath} exists: ${newUserDataPathExists ? "yes" : "no"}`);
    console.log(`${oldUserDataPath} exists: ${oldUserDataPathExists ? "yes" : "no"}`);

    if (!newUserDataPathExists && oldUserDataPathExists) {
        console.log(`Using legacy user data path: ${oldUserDataPath}`);
        return oldUserDataPath;
    }
    return newUserDataPath;
}

/**
 * Parses command line arguments and handles the `--help` flag.
 * If `--help` is present, it prints usage information and exits the application.
 * Must be called before Electron's userData is set.
 */
export function getArgs(protocolHandler: ProtocolHandler): Args {
    const argv = minimist(process.argv, {
        alias: { help: "h" },
    });

    if (argv["help"]) {
        console.log("Options:");
        console.log("  --profile-dir {path}: Path to where to store the profile.");
        console.log(
            `  --profile {name}:     Name of alternate profile to use, allows for running multiple accounts.\n` +
                `                         Ignored if --profile-dir is specified.\n` +
                `                         The ELEMENT_PROFILE_DIR environment variable may be used to change the default profile path.\n` +
                `                         It is overridden by --profile-dir, but can be combined with --profile.`,
        );
        console.log("  --devtools:           Install and use react-devtools and react-perf.");
        console.log(
            `  --config:             Path to the config.json file. May also be specified via the ELEMENT_DESKTOP_CONFIG_JSON environment variable.\n` +
                `                         Otherwise use the default user location '${defaultUserDataDir}'`,
        );
        console.log("  --no-update:          Disable automatic updating.");
        console.log("  --hidden:             Start the application hidden in the system tray.");
        console.log("  --help:               Displays this help message.");
        console.log("And more such as --proxy, see: https://electronjs.org/docs/api/command-line-switches");
        app.exit();
    }

    let storageMode: Mode | undefined;
    if ([Mode.Encrypted, Mode.ForcePlaintext, Mode.AllowPlaintext].includes(argv["storage-mode"])) {
        storageMode = argv["storage-mode"];
    }

    return {
        userDataPath: getUserDataPath(argv, protocolHandler),
        localConfigPath: argv["config"] ?? process.env.ELEMENT_DESKTOP_CONFIG_JSON,
        storageMode,
        devtools: argv["devtools"] || false,
        // Minimist parses `--no-`-prefixed arguments as booleans with value `false` rather than verbatim.
        update: argv["update"] ?? true,
        hidden: argv["hidden"] || false,
        positional: argv["_"],
    };
}

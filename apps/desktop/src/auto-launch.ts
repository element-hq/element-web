/*
Copyright 2025-2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app, type Settings } from "electron";
import path from "node:path";

import Store from "./store.js";
import { getSquirrelExecutable } from "./squirrelhooks.js";

export type AutoLaunchState = "enabled" | "minimised" | "disabled";

/**
 * Controls whether the app launches automatically at OS login.
 *
 * Uses Electron's native loginItem API (`app.setLoginItemSettings` / `app.getLoginItemSettings`)
 * rather than the unmaintained `auto-launch` npm package. That package failed to actually launch
 * the app at login on macOS (fragile LaunchAgent plist path resolution for `.app` bundles, not
 * refreshed across app updates) while still reporting the option as enabled. See element-web#32303.
 */
export class AutoLaunch {
    private static internalInstance?: AutoLaunch;

    public static get instance(): AutoLaunch {
        if (!AutoLaunch.internalInstance) {
            AutoLaunch.internalInstance = new AutoLaunch();
        }
        return AutoLaunch.internalInstance;
    }

    /**
     * Build the platform-specific options to enable the login item.
     *
     * On Windows the app is installed via Squirrel into a versioned `app-x.y.z` directory, so the
     * login item must point at the stable `Update.exe` (`--processStart`) rather than the versioned
     * executable, otherwise it breaks on the next update. `openAsHidden` is a macOS-only flag.
     *
     * @param minimised - whether the app should start hidden/minimised.
     */
    private enableSettings(minimised: boolean): Settings {
        if (process.platform === "win32") {
            const exeName = path.basename(process.execPath);
            const args = ["--processStart", `"${exeName}"`];
            if (minimised) {
                args.push("--process-start-args", "--hidden");
            }
            return {
                openAtLogin: true,
                path: getSquirrelExecutable(),
                args,
            };
        }

        return {
            openAtLogin: true,
            openAsHidden: minimised, // macOS-only; ignored on Linux
            args: minimised ? ["--hidden"] : [],
        };
    }

    public async getState(): Promise<AutoLaunchState> {
        if (!app.getLoginItemSettings().openAtLogin) {
            return "disabled";
        }
        return Store.instance?.get("openAtLoginMinimised") ? "minimised" : "enabled";
    }

    public async setState(state: AutoLaunchState): Promise<void> {
        const minimised = state === "minimised";
        Store.instance?.set("openAtLoginMinimised", minimised);

        if (state === "disabled") {
            app.setLoginItemSettings({ openAtLogin: false });
        } else {
            app.setLoginItemSettings(this.enableSettings(minimised));
        }
    }
}

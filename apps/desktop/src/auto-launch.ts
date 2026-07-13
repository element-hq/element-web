/*
Copyright 2025-2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app, type Settings } from "electron";
import fs from "node:fs";
import path from "node:path";

import Store from "./store.js";
import { getSquirrelExecutable } from "./squirrelhooks.js";

export type AutoLaunchState = "enabled" | "minimised" | "disabled";

/**
 * The name the legacy `auto-launch` npm package used for its on-disk artifacts.
 *
 * That package derived the name from the executable path — `basename(process.execPath)`, with a
 * trailing `.exe` stripped on Windows — rather than from the configured brand. We replicate that
 * derivation exactly so the one-time migration ({@link AutoLaunch.migrate}) can find and remove the
 * artifacts it left behind: the macOS LaunchAgent plist, the Linux XDG autostart entry, and the
 * Windows `Run` registry value.
 */
export function legacyArtifactName(): string {
    if (process.platform === "win32") {
        return path.win32.basename(process.execPath, ".exe");
    }
    return path.posix.basename(process.execPath);
}

/** `~/Library/LaunchAgents/<name>.plist` — the artifact the old package wrote on macOS. */
function legacyMacLaunchAgentPath(): string {
    return path.join(app.getPath("home"), "Library", "LaunchAgents", `${legacyArtifactName()}.plist`);
}

/** The XDG base dir for config, honouring `$XDG_CONFIG_HOME` (defaulting to `~/.config`). */
function xdgConfigHome(): string {
    return process.env["XDG_CONFIG_HOME"] || path.join(app.getPath("home"), ".config");
}

/**
 * The XDG autostart entry we manage on Linux, `$XDG_CONFIG_HOME/autostart/<name>.desktop`.
 *
 * Electron's loginItem API is a no-op on Linux, so we write this file ourselves to keep
 * start-at-login working there.
 */
function linuxAutostartPath(): string {
    return path.join(xdgConfigHome(), "autostart", `${legacyArtifactName()}.desktop`);
}

/**
 * The path the legacy `auto-launch` package used on Linux. It hard-coded `~/.config/autostart`
 * regardless of `$XDG_CONFIG_HOME`, so the migration must look there specifically.
 */
function legacyLinuxAutostartPath(): string {
    return path.join(app.getPath("home"), ".config", "autostart", `${legacyArtifactName()}.desktop`);
}

/**
 * Escape a value for use inside a double-quoted Desktop Entry `Exec` argument. The spec requires the
 * reserved characters `"`, `` ` ``, `$` and `\` to be backslash-escaped, and a literal `%` doubled.
 */
function escapeDesktopExecArg(value: string): string {
    return value.replace(/(["\\$`])/g, "\\$1").replace(/%/g, "%%");
}

function linuxDesktopEntry(minimised: boolean): string {
    const name = legacyArtifactName();
    const exec = `"${escapeDesktopExecArg(process.execPath)}"${minimised ? " --hidden" : ""}`;
    return (
        "[Desktop Entry]\n" +
        "Type=Application\n" +
        "Version=1.0\n" +
        `Name=${name}\n` +
        `Comment=${name} startup script\n` +
        `Exec=${exec}\n` +
        "StartupNotify=false\n" +
        "Terminal=false\n"
    );
}

/**
 * Whether the app should start hidden (minimised to tray) for this launch.
 *
 * On Windows/Linux the login item passes `--hidden`, surfaced here as `argsHidden`. On macOS the
 * native loginItem API cannot pass arguments and `openAsHidden` is a no-op on macOS 13+, so we
 * instead derive it from `wasOpenedAtLogin` plus the stored minimised preference.
 */
export function shouldStartHidden(argsHidden: boolean): boolean {
    if (argsHidden) return true;
    if (process.platform === "darwin") {
        return (
            Boolean(app.getLoginItemSettings().wasOpenedAtLogin) && Boolean(Store.instance?.get("openAtLoginMinimised"))
        );
    }
    return false;
}

/**
 * Controls whether the app launches automatically at OS login.
 *
 * Uses Electron's native loginItem API (`app.setLoginItemSettings` / `app.getLoginItemSettings`) on
 * macOS and Windows rather than the unmaintained `auto-launch` npm package, which failed to actually
 * launch the app at login on macOS (fragile LaunchAgent plist path resolution for `.app` bundles,
 * not refreshed across app updates) while still reporting the option as enabled. See element-web#32303.
 *
 * The native API is not implemented on Linux, so there we manage an XDG autostart `.desktop` file
 * directly. {@link migrate} performs a one-time migration off the old package's artifacts.
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
     * On Windows a Squirrel install lives in a versioned `app-x.y.z` directory, so the login item
     * must point at the stable `Update.exe` (`--processStart`) rather than the versioned executable,
     * otherwise it breaks on the next update. MSI installs have no `Update.exe`, so there we launch
     * the executable directly (its location is stable across updates). `openAsHidden` is macOS-only.
     *
     * @param minimised - whether the app should start hidden/minimised.
     */
    private enableSettings(minimised: boolean): Settings {
        if (process.platform === "win32") {
            const squirrel = getSquirrelExecutable();
            if (fs.existsSync(squirrel)) {
                const exeName = path.win32.basename(process.execPath);
                const args = ["--processStart", `"${exeName}"`];
                if (minimised) {
                    args.push("--process-start-args", "--hidden");
                }
                return { openAtLogin: true, path: squirrel, args };
            }
            // Non-Squirrel (MSI) install: Update.exe is absent, so launch the executable directly.
            return { openAtLogin: true, path: process.execPath, args: minimised ? ["--hidden"] : [] };
        }

        return {
            openAtLogin: true,
            openAsHidden: minimised, // macOS-only, no-op on macOS 13+ (see shouldStartHidden); ignored on Linux
            args: minimised ? ["--hidden"] : [],
        };
    }

    /**
     * On Windows `getLoginItemSettings` only resolves the entry we registered when passed the same
     * `path`/`args`, so we pass the enable command through (using the non-minimised args, since
     * {@link getState} relies on `executableWillLaunchAtLogin`, which ignores the exact args).
     */
    private queryOptions(): Electron.LoginItemSettingsOptions | undefined {
        if (process.platform === "win32") {
            const { path: exePath, args } = this.enableSettings(false);
            return { path: exePath, args };
        }
        return undefined;
    }

    public async getState(): Promise<AutoLaunchState> {
        let enabled: boolean;
        if (process.platform === "linux") {
            enabled = fs.existsSync(linuxAutostartPath());
        } else if (process.platform === "win32") {
            // `executableWillLaunchAtLogin` ignores the exact args (so a minimised item still reads
            // as enabled) and reflects Windows "Startup Apps" deactivation, unlike `openAtLogin`.
            enabled = app.getLoginItemSettings(this.queryOptions()).executableWillLaunchAtLogin;
        } else {
            enabled = app.getLoginItemSettings().openAtLogin;
        }

        if (!enabled) {
            return "disabled";
        }
        return Store.instance?.get("openAtLoginMinimised") ? "minimised" : "enabled";
    }

    public async setState(state: AutoLaunchState): Promise<void> {
        const minimised = state === "minimised";
        Store.instance?.set("openAtLoginMinimised", minimised);

        if (process.platform === "linux") {
            const file = linuxAutostartPath();
            if (state === "disabled") {
                fs.rmSync(file, { force: true });
            } else {
                fs.mkdirSync(path.dirname(file), { recursive: true });
                fs.writeFileSync(file, linuxDesktopEntry(minimised), "utf8");
            }
            return;
        }

        if (state === "disabled") {
            app.setLoginItemSettings({ openAtLogin: false });
        } else {
            app.setLoginItemSettings(this.enableSettings(minimised));
        }
    }

    /**
     * Confirm a LaunchAgent plist is the node-auto-launch artifact for *this* app before we delete
     * it, so we never remove an unrelated similarly-named plist. The old package named the launchd
     * `Label` after the app and ran our executable via `ProgramArguments`.
     */
    private isLegacyMacLaunchAgent(plistPath: string): boolean {
        let content: string;
        try {
            content = fs.readFileSync(plistPath, "utf8");
        } catch {
            return false; // missing or unreadable
        }
        return content.includes(`<string>${legacyArtifactName()}</string>`) && content.includes(process.execPath);
    }

    /**
     * One-time migration from the legacy `auto-launch` package to the native loginItem API.
     *
     * The old package registered start-at-login through a mechanism the native API cannot see (a
     * macOS LaunchAgent plist, a Windows `Run` value under a different name), so without this an
     * upgraded user would (a) see the toggle silently flip to off and (b) be left with an artifact
     * the app can no longer remove. This detects the previous state, re-applies it natively, and
     * removes the orphaned artifact. It is idempotent and safe to run more than once; the caller
     * guards it with a persisted `autoLaunchMigrated` flag and only records success once it returns.
     */
    public async migrate(): Promise<void> {
        const minimised = Boolean(Store.instance?.get("openAtLoginMinimised"));

        if (process.platform === "darwin") {
            const plist = legacyMacLaunchAgentPath();
            if (!this.isLegacyMacLaunchAgent(plist)) return;
            // The user had start-at-login enabled under the old package: re-register it natively so
            // the preference survives, then delete the orphaned LaunchAgent plist so it can no longer
            // launch the app behind the UI's back. (A RunAtLoad agent only fires at login, so
            // deleting the file is enough — there is no persistent job to unload.)
            await this.setState(minimised ? "minimised" : "enabled");
            fs.rmSync(plist, { force: true });
            return;
        }

        if (process.platform === "win32") {
            const legacyName = legacyArtifactName();
            const items = app.getLoginItemSettings(this.queryOptions()).launchItems ?? [];
            // The legacy value is a per-user (HKCU) Run value; match its name case-insensitively as
            // the Windows registry does, and ignore any machine-scope entry.
            const legacy = items.find(
                (item) => item.name.toLowerCase() === legacyName.toLowerCase() && item.scope !== "machine",
            );
            if (!legacy) return;

            // Re-register natively FIRST so a crash mid-migration leaves the legacy value intact for
            // the next launch to retry, rather than removing auto-launch and never restoring it.
            // Respect a user who disabled it via Windows "Startup Apps" by not re-enabling.
            if (legacy.enabled !== false) {
                await this.setState(minimised ? "minimised" : "enabled");
            }

            // Remove the exact legacy Run value we found, unless the native registration reused the
            // same value name (Electron would then have overwritten it in place and there is nothing
            // separate to delete — removing it would undo what we just wrote).
            const registeredPath = this.enableSettings(minimised).path?.toLowerCase();
            const nativeReusedLegacyName = (app.getLoginItemSettings(this.queryOptions()).launchItems ?? []).some(
                (item) =>
                    item.name.toLowerCase() === legacy.name.toLowerCase() &&
                    item.path?.toLowerCase() === registeredPath,
            );
            if (!nativeReusedLegacyName) {
                app.setLoginItemSettings({ openAtLogin: false, name: legacy.name });
            }
            return;
        }

        // Linux: the old package hard-coded `~/.config/autostart`. If an entry is there, rewrite it
        // cleanly at the current XDG path (fixing any stale/`Hidden=true` legacy entry) preserving
        // the minimised preference, then remove the old file if it lived at a different location.
        const legacyPath = legacyLinuxAutostartPath();
        if (!fs.existsSync(legacyPath)) return;
        await this.setState(minimised ? "minimised" : "enabled");
        if (path.resolve(legacyPath) !== path.resolve(linuxAutostartPath())) {
            fs.rmSync(legacyPath, { force: true });
        }
    }
}

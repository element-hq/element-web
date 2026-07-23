/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeEach, afterEach, vi } from "vitest";
import { app } from "electron";
import fs from "node:fs";

import { AutoLaunch, legacyArtifactName, shouldStartHidden } from "./auto-launch.js";
import Store from "./store.js";

vi.mock("electron", () => ({
    app: {
        setLoginItemSettings: vi.fn(),
        getLoginItemSettings: vi.fn(() => ({ openAtLogin: false })),
        getPath: vi.fn(() => "/home/user"),
    },
}));

vi.mock("./store.js", () => ({
    default: { instance: { get: vi.fn(), set: vi.fn() } },
}));

vi.mock("./squirrelhooks.js", () => ({
    getSquirrelExecutable: vi.fn(() => "C:\\Element\\Update.exe"),
}));

vi.mock("node:fs", () => ({
    default: {
        existsSync: vi.fn(() => false),
        readFileSync: vi.fn(() => ""),
        writeFileSync: vi.fn(),
        rmSync: vi.fn(),
        mkdirSync: vi.fn(),
    },
}));

const MAC_EXECPATH = "/Applications/Element.app/Contents/MacOS/Element";
const WIN_EXECPATH = "C:\\Users\\me\\AppData\\Local\\Element\\app-1.2.3\\Element.exe";
const LINUX_EXECPATH = "/opt/Element/element-desktop";

// A realistic node-auto-launch LaunchAgent plist for this app (Label = app name, runs our executable).
const LEGACY_PLIST =
    `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n` +
    `  <key>Label</key>\n  <string>Element</string>\n  <key>ProgramArguments</key>\n  <array>\n` +
    `    <string>${MAC_EXECPATH}</string>\n  </array>\n  <key>RunAtLoad</key>\n  <true/>\n</dict>\n</plist>`;

const REAL_PLATFORM = process.platform;
const REAL_EXECPATH = process.execPath;
const REAL_XDG = process.env["XDG_CONFIG_HOME"];

/** Override process.platform (+ optionally execPath) for a test, restored in afterEach. */
function setPlatform(platform: NodeJS.Platform, execPath?: string): void {
    Object.defineProperty(process, "platform", { value: platform, configurable: true });
    if (execPath !== undefined) {
        Object.defineProperty(process, "execPath", { value: execPath, configurable: true });
    }
}

describe("AutoLaunch", () => {
    const autoLaunch = AutoLaunch.instance;
    const setLoginItemSettings = vi.mocked(app.setLoginItemSettings);
    const getLoginItemSettings = vi.mocked(app.getLoginItemSettings);
    const storeGet = vi.mocked(Store.instance!.get);
    const storeSet = vi.mocked(Store.instance!.set);
    const existsSync = vi.mocked(fs.existsSync);
    const readFileSync = vi.mocked(fs.readFileSync);
    const writeFileSync = vi.mocked(fs.writeFileSync);
    const rmSync = vi.mocked(fs.rmSync);

    beforeEach(() => {
        vi.clearAllMocks();
        getLoginItemSettings.mockReturnValue({ openAtLogin: false } as Electron.LoginItemSettings);
        existsSync.mockReturnValue(false);
        delete process.env["XDG_CONFIG_HOME"];
    });

    afterEach(() => {
        Object.defineProperty(process, "platform", { value: REAL_PLATFORM, configurable: true });
        Object.defineProperty(process, "execPath", { value: REAL_EXECPATH, configurable: true });
        if (REAL_XDG === undefined) delete process.env["XDG_CONFIG_HOME"];
        else process.env["XDG_CONFIG_HOME"] = REAL_XDG;
    });

    describe("legacyArtifactName", () => {
        it("strips the .exe extension on Windows", () => {
            setPlatform("win32", WIN_EXECPATH);
            expect(legacyArtifactName()).toBe("Element");
        });

        it("uses the executable basename on macOS", () => {
            setPlatform("darwin", MAC_EXECPATH);
            expect(legacyArtifactName()).toBe("Element");
        });

        it("uses the executable basename on Linux", () => {
            setPlatform("linux", LINUX_EXECPATH);
            expect(legacyArtifactName()).toBe("element-desktop");
        });
    });

    describe("setState (macOS)", () => {
        beforeEach(() => setPlatform("darwin", MAC_EXECPATH));

        it("enables auto-launch (not minimised) via the native loginItem API", async () => {
            await autoLaunch.setState("enabled");

            expect(storeSet).toHaveBeenCalledWith("openAtLoginMinimised", false);
            expect(setLoginItemSettings).toHaveBeenCalledWith(
                expect.objectContaining({ openAtLogin: true, openAsHidden: false }),
            );
        });

        it("enables auto-launch minimised (hidden) at login", async () => {
            await autoLaunch.setState("minimised");

            expect(storeSet).toHaveBeenCalledWith("openAtLoginMinimised", true);
            expect(setLoginItemSettings).toHaveBeenCalledWith(
                expect.objectContaining({ openAtLogin: true, openAsHidden: true, args: ["--hidden"] }),
            );
        });

        it("disables auto-launch", async () => {
            await autoLaunch.setState("disabled");

            expect(storeSet).toHaveBeenCalledWith("openAtLoginMinimised", false);
            expect(setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: false });
        });
    });

    describe("getState (macOS)", () => {
        beforeEach(() => setPlatform("darwin", MAC_EXECPATH));

        it("returns 'disabled' when the OS login item is off", async () => {
            getLoginItemSettings.mockReturnValue({ openAtLogin: false } as Electron.LoginItemSettings);
            await expect(autoLaunch.getState()).resolves.toBe("disabled");
        });

        it("returns 'enabled' when the login item is on and not minimised", async () => {
            getLoginItemSettings.mockReturnValue({ openAtLogin: true } as Electron.LoginItemSettings);
            storeGet.mockReturnValue(false);
            await expect(autoLaunch.getState()).resolves.toBe("enabled");
        });

        it("returns 'minimised' when the login item is on and minimised", async () => {
            getLoginItemSettings.mockReturnValue({ openAtLogin: true } as Electron.LoginItemSettings);
            storeGet.mockReturnValue(true);
            await expect(autoLaunch.getState()).resolves.toBe("minimised");
        });
    });

    describe("getState / setState (Linux)", () => {
        const autostartPath = "/home/user/.config/autostart/element-desktop.desktop";
        beforeEach(() => setPlatform("linux", LINUX_EXECPATH));

        it("returns 'disabled' when no autostart .desktop file exists", async () => {
            existsSync.mockReturnValue(false);
            await expect(autoLaunch.getState()).resolves.toBe("disabled");
        });

        it("returns 'enabled' when the autostart file exists and not minimised", async () => {
            existsSync.mockReturnValue(true);
            storeGet.mockReturnValue(false);
            await expect(autoLaunch.getState()).resolves.toBe("enabled");
        });

        it("returns 'minimised' when the autostart file exists and minimised", async () => {
            existsSync.mockReturnValue(true);
            storeGet.mockReturnValue(true);
            await expect(autoLaunch.getState()).resolves.toBe("minimised");
        });

        it("does NOT touch the native loginItem API on Linux", async () => {
            existsSync.mockReturnValue(true);
            await autoLaunch.getState();
            expect(getLoginItemSettings).not.toHaveBeenCalled();
        });

        it("enable writes an XDG autostart .desktop file", async () => {
            await autoLaunch.setState("enabled");

            expect(storeSet).toHaveBeenCalledWith("openAtLoginMinimised", false);
            expect(writeFileSync).toHaveBeenCalledWith(
                autostartPath,
                expect.stringContaining("[Desktop Entry]"),
                expect.anything(),
            );
            expect(setLoginItemSettings).not.toHaveBeenCalled();
        });

        it("enable minimised adds --hidden to the Exec line", async () => {
            await autoLaunch.setState("minimised");

            expect(writeFileSync).toHaveBeenCalledWith(
                autostartPath,
                expect.stringContaining("--hidden"),
                expect.anything(),
            );
        });

        it("disable removes the autostart file", async () => {
            await autoLaunch.setState("disabled");

            expect(rmSync).toHaveBeenCalledWith(autostartPath, expect.objectContaining({ force: true }));
            expect(setLoginItemSettings).not.toHaveBeenCalled();
        });

        it("honours $XDG_CONFIG_HOME for the autostart path", async () => {
            process.env["XDG_CONFIG_HOME"] = "/home/user/.xdg";
            await autoLaunch.setState("enabled");

            expect(writeFileSync).toHaveBeenCalledWith(
                "/home/user/.xdg/autostart/element-desktop.desktop",
                expect.any(String),
                expect.anything(),
            );
        });

        it("escapes Desktop Entry reserved characters in the Exec path", async () => {
            setPlatform("linux", "/opt/wei$rd/Elem`ent/element-desktop");
            await autoLaunch.setState("enabled");

            const written = writeFileSync.mock.calls[0][1] as string;
            expect(written).toContain("\\$");
            expect(written).toContain("\\`");
        });
    });

    describe("getState / setState (Windows)", () => {
        beforeEach(() => {
            setPlatform("win32", WIN_EXECPATH);
            existsSync.mockReturnValue(true); // Squirrel Update.exe present (default install type)
        });

        it("reports enabled via executableWillLaunchAtLogin (ignores exact args / respects Startup Apps)", async () => {
            // openAtLogin false but the executable will still launch (e.g. minimised args differ) => enabled
            getLoginItemSettings.mockReturnValue({
                openAtLogin: false,
                executableWillLaunchAtLogin: true,
            } as Electron.LoginItemSettings);
            storeGet.mockReturnValue(true);

            await expect(autoLaunch.getState()).resolves.toBe("minimised");
        });

        it("reports disabled when the executable will not launch at login", async () => {
            getLoginItemSettings.mockReturnValue({
                openAtLogin: true,
                executableWillLaunchAtLogin: false,
            } as Electron.LoginItemSettings);

            await expect(autoLaunch.getState()).resolves.toBe("disabled");
        });

        it("queries the login item with the Squirrel path/args", async () => {
            getLoginItemSettings.mockReturnValue({
                executableWillLaunchAtLogin: true,
            } as Electron.LoginItemSettings);
            storeGet.mockReturnValue(false);

            await expect(autoLaunch.getState()).resolves.toBe("enabled");
            expect(getLoginItemSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: "C:\\Element\\Update.exe",
                    args: ["--processStart", '"Element.exe"'],
                }),
            );
        });

        it("enables via the stable Squirrel Update.exe --processStart", async () => {
            await autoLaunch.setState("enabled");
            expect(setLoginItemSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    openAtLogin: true,
                    path: "C:\\Element\\Update.exe",
                    args: ["--processStart", '"Element.exe"'],
                }),
            );
        });

        it("enables minimised by passing --process-start-args --hidden", async () => {
            await autoLaunch.setState("minimised");
            expect(setLoginItemSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    args: ["--processStart", '"Element.exe"', "--process-start-args", "--hidden"],
                }),
            );
        });

        it("falls back to launching the executable directly on non-Squirrel (MSI) installs", async () => {
            existsSync.mockReturnValue(false); // Update.exe absent => MSI install
            await autoLaunch.setState("enabled");
            expect(setLoginItemSettings).toHaveBeenCalledWith(
                expect.objectContaining({ openAtLogin: true, path: WIN_EXECPATH, args: [] }),
            );
        });

        it("disables by clearing the login item", async () => {
            await autoLaunch.setState("disabled");

            expect(storeSet).toHaveBeenCalledWith("openAtLoginMinimised", false);
            // Electron keys the `Run` value by AppUserModelId — the same name it wrote when enabling —
            // so clearing `openAtLogin` removes it; the path/args are not needed to remove it.
            expect(setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: false });
            expect(rmSync).not.toHaveBeenCalled();
        });

        it("does not touch the filesystem on Windows", async () => {
            await autoLaunch.setState("enabled");
            expect(writeFileSync).not.toHaveBeenCalled();
        });
    });

    describe("migrate (macOS)", () => {
        const plistPath = "/home/user/Library/LaunchAgents/Element.plist";
        beforeEach(() => {
            setPlatform("darwin", MAC_EXECPATH);
            readFileSync.mockReturnValue(LEGACY_PLIST);
        });

        it("re-registers the native login item and deletes the orphan LaunchAgent plist", async () => {
            storeGet.mockReturnValue(false);

            await autoLaunch.migrate();

            expect(setLoginItemSettings).toHaveBeenCalledWith(expect.objectContaining({ openAtLogin: true }));
            expect(rmSync).toHaveBeenCalledWith(plistPath, expect.objectContaining({ force: true }));
        });

        it("preserves the minimised preference when migrating", async () => {
            storeGet.mockReturnValue(true);

            await autoLaunch.migrate();

            expect(setLoginItemSettings).toHaveBeenCalledWith(
                expect.objectContaining({ openAtLogin: true, openAsHidden: true }),
            );
        });

        it("does nothing when there is no legacy plist (never enabled)", async () => {
            readFileSync.mockImplementation(() => {
                throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
            });

            await autoLaunch.migrate();

            expect(setLoginItemSettings).not.toHaveBeenCalled();
            expect(rmSync).not.toHaveBeenCalled();
        });

        it("does not delete a plist that is not a node-auto-launch artifact for this app", async () => {
            readFileSync.mockReturnValue(
                "<plist><dict><key>Label</key><string>com.other.app</string><key>ProgramArguments</key>" +
                    "<array><string>/Applications/Other.app/Contents/MacOS/Other</string></array></dict></plist>",
            );

            await autoLaunch.migrate();

            expect(rmSync).not.toHaveBeenCalled();
            expect(setLoginItemSettings).not.toHaveBeenCalled();
        });
    });

    describe("migrate (Windows)", () => {
        beforeEach(() => {
            setPlatform("win32", WIN_EXECPATH);
            existsSync.mockReturnValue(true);
        });

        it("re-registers natively and removes the legacy Run value when it was enabled", async () => {
            getLoginItemSettings.mockReturnValue({
                launchItems: [{ name: "Element", enabled: true, scope: "user" }],
            } as unknown as Electron.LoginItemSettings);
            storeGet.mockReturnValue(false);

            await autoLaunch.migrate();

            expect(setLoginItemSettings).toHaveBeenCalledWith(
                expect.objectContaining({ openAtLogin: true, path: "C:\\Element\\Update.exe" }),
            );
            expect(setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: false, name: "Element" });
        });

        it("matches the legacy value case-insensitively and ignores machine-scope entries", async () => {
            getLoginItemSettings.mockReturnValue({
                launchItems: [
                    { name: "element", enabled: true, scope: "user" },
                    { name: "Element", enabled: false, scope: "machine" },
                ],
            } as unknown as Electron.LoginItemSettings);
            storeGet.mockReturnValue(false);

            await autoLaunch.migrate();

            // the user-scope 'element' entry is enabled => re-register (not treated as disabled by the machine entry)
            expect(setLoginItemSettings).toHaveBeenCalledWith(expect.objectContaining({ openAtLogin: true }));
            expect(setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: false, name: "element" });
        });

        it("removes a legacy value the user had disabled without re-enabling it", async () => {
            getLoginItemSettings.mockReturnValue({
                launchItems: [{ name: "Element", enabled: false, scope: "user" }],
            } as unknown as Electron.LoginItemSettings);

            await autoLaunch.migrate();

            expect(setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: false, name: "Element" });
            expect(setLoginItemSettings).not.toHaveBeenCalledWith(expect.objectContaining({ openAtLogin: true }));
        });

        it("does nothing when there is no legacy Run value", async () => {
            getLoginItemSettings.mockReturnValue({
                launchItems: [{ name: "SomeOtherApp", enabled: true, scope: "user" }],
            } as unknown as Electron.LoginItemSettings);

            await autoLaunch.migrate();

            expect(setLoginItemSettings).not.toHaveBeenCalled();
        });
    });

    describe("migrate (Linux)", () => {
        const autostartPath = "/home/user/.config/autostart/element-desktop.desktop";
        beforeEach(() => setPlatform("linux", LINUX_EXECPATH));

        it("rewrites the autostart entry cleanly in place, preserving the enabled state", async () => {
            existsSync.mockReturnValue(true); // legacy file present
            storeGet.mockReturnValue(false);

            await autoLaunch.migrate();

            // rewritten via setState (fixing the legacy unquoted Exec path); same path => no removal
            expect(writeFileSync).toHaveBeenCalledWith(
                autostartPath,
                expect.stringContaining("[Desktop Entry]"),
                expect.anything(),
            );
            expect(rmSync).not.toHaveBeenCalled();
            await expect(autoLaunch.getState()).resolves.toBe("enabled");
        });

        it("migrates a legacy ~/.config entry to the $XDG_CONFIG_HOME path and removes the old file", async () => {
            process.env["XDG_CONFIG_HOME"] = "/home/user/.xdg";
            existsSync.mockReturnValue(true);
            storeGet.mockReturnValue(false);

            await autoLaunch.migrate();

            expect(writeFileSync).toHaveBeenCalledWith(
                "/home/user/.xdg/autostart/element-desktop.desktop",
                expect.any(String),
                expect.anything(),
            );
            expect(rmSync).toHaveBeenCalledWith(autostartPath, expect.objectContaining({ force: true }));
        });

        it("does nothing when there is no legacy autostart entry", async () => {
            existsSync.mockReturnValue(false);

            await autoLaunch.migrate();

            expect(writeFileSync).not.toHaveBeenCalled();
            expect(rmSync).not.toHaveBeenCalled();
        });
    });

    describe("shouldStartHidden", () => {
        it("returns true when the --hidden CLI arg is set (any platform)", () => {
            setPlatform("linux");
            expect(shouldStartHidden(true)).toBe(true);
        });

        it("returns true on macOS when opened at login with the minimised preference", () => {
            setPlatform("darwin");
            getLoginItemSettings.mockReturnValue({ wasOpenedAtLogin: true } as Electron.LoginItemSettings);
            storeGet.mockReturnValue(true);
            expect(shouldStartHidden(false)).toBe(true);
        });

        it("returns false on macOS when opened at login but NOT minimised", () => {
            setPlatform("darwin");
            getLoginItemSettings.mockReturnValue({ wasOpenedAtLogin: true } as Electron.LoginItemSettings);
            storeGet.mockReturnValue(false);
            expect(shouldStartHidden(false)).toBe(false);
        });

        it("returns false on macOS when not opened at login", () => {
            setPlatform("darwin");
            getLoginItemSettings.mockReturnValue({ wasOpenedAtLogin: false } as Electron.LoginItemSettings);
            storeGet.mockReturnValue(true);
            expect(shouldStartHidden(false)).toBe(false);
        });

        it("does not consult wasOpenedAtLogin on non-macOS platforms", () => {
            setPlatform("win32");
            expect(shouldStartHidden(false)).toBe(false);
            expect(getLoginItemSettings).not.toHaveBeenCalled();
        });
    });
});

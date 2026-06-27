/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeEach, vi } from "vitest";
import { app } from "electron";

import { AutoLaunch } from "./auto-launch.js";
import Store from "./store.js";

vi.mock("electron", () => ({
    app: {
        setLoginItemSettings: vi.fn(),
        getLoginItemSettings: vi.fn(() => ({ openAtLogin: false })),
    },
}));

vi.mock("./store.js", () => ({
    default: { instance: { get: vi.fn(), set: vi.fn() } },
}));

vi.mock("./squirrelhooks.js", () => ({
    getSquirrelExecutable: vi.fn(() => "C:/Element/Update.exe"),
}));

// These tests run on darwin (the platform the bug primarily affects), exercising the non-Windows path.
describe("AutoLaunch", () => {
    const autoLaunch = AutoLaunch.instance;
    const setLoginItemSettings = vi.mocked(app.setLoginItemSettings);
    const getLoginItemSettings = vi.mocked(app.getLoginItemSettings);
    const storeGet = vi.mocked(Store.instance!.get);
    const storeSet = vi.mocked(Store.instance!.set);

    beforeEach(() => {
        vi.clearAllMocks();
        getLoginItemSettings.mockReturnValue({ openAtLogin: false } as Electron.LoginItemSettings);
    });

    describe("setState", () => {
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

    describe("getState", () => {
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
});

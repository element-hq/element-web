/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeEach, afterEach, vi } from "vitest";
import { app, autoUpdater, ipcMain } from "electron";
import os from "node:os";

import { start } from "./updater.js";
import Store from "./store.js";

vi.mock("electron", () => ({
    app: {
        getVersion: vi.fn(() => "1.0.0"),
    },
    // autoUpdater registers listeners at import time; the chained `.on()` calls must return `this`.
    autoUpdater: {
        on: vi.fn().mockReturnThis(),
        setFeedURL: vi.fn(),
        getFeedURL: vi.fn(() => "https://feed.example/macos/releases.json"),
        checkForUpdates: vi.fn(),
        quitAndInstall: vi.fn(),
    },
    ipcMain: {
        on: vi.fn(),
        emit: vi.fn(),
    },
}));

vi.mock("node:fs/promises", () => {
    const access = vi.fn(() => Promise.resolve());
    return { default: { access }, access };
});

vi.mock("node:os", () => {
    const release = vi.fn(() => "23.0.0"); // Darwin 23 = macOS Sonoma (modern, auto-update supported)
    return { default: { release }, release };
});

vi.mock("./squirrelhooks.js", () => ({
    getSquirrelExecutable: vi.fn(() => "/path/to/Update.exe"),
}));

vi.mock("./language-helper.js", () => ({
    _t: vi.fn((key: string) => key),
}));

vi.mock("./ipc.js", () => ({
    initialisePromise: Promise.resolve(),
}));

vi.mock("./config.js", () => ({
    getConfig: vi.fn(() => ({ brand: "Element" })),
}));

vi.mock("./store.js", () => {
    const instance = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
    return { default: { instance } };
});

const getVersion = vi.mocked(app.getVersion);
const release = vi.mocked(os.release);
const setFeedURL = vi.mocked(autoUpdater.setFeedURL);
const storeGet = vi.mocked(Store.instance!.get);
const storeSet = vi.mocked(Store.instance!.set);
const storeDelete = vi.mocked(Store.instance!.delete);

type Listener = (...args: unknown[]) => void;

// The module registers its IPC and autoUpdater listeners once, at import time. Snapshot them here,
// while the recorded calls still exist — `clearAllMocks` in `beforeEach` would otherwise discard them.
const ipcListeners = new Map(vi.mocked(ipcMain.on).mock.calls as unknown as [string, Listener][]);
const updaterListeners = new Map(vi.mocked(autoUpdater.on).mock.calls as unknown as [string, Listener][]);

function ipcHandler(channel: string): Listener {
    const handler = ipcListeners.get(channel);
    if (!handler) throw new Error(`No handler registered for ${channel}`);
    return handler;
}

/** Stub the store as if `pendingUpdateVersion`/`failedUpdateInstalls` held these values. */
function givenStore(values: { pendingUpdateVersion?: string; failedUpdateInstalls?: number }): void {
    storeGet.mockImplementation((key: string) => values[key as keyof typeof values]);
}

const originalPlatform = process.platform;
function setPlatform(platform: NodeJS.Platform): void {
    Object.defineProperty(process, "platform", { value: platform, configurable: true });
}

let setIntervalSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    vi.clearAllMocks();
    getVersion.mockReturnValue("1.0.0");
    release.mockReturnValue("23.0.0");
    givenStore({});
    setPlatform("darwin");
    // Asserting on the interval registration keeps these tests off the network: the poll itself
    // fetches the release feed, which is not what is under test here.
    setIntervalSpy = vi.spyOn(global, "setInterval").mockReturnValue(0 as unknown as NodeJS.Timeout);
    vi.spyOn(global, "setTimeout").mockReturnValue(0 as unknown as NodeJS.Timeout);
});

afterEach(() => {
    setPlatform(originalPlatform);
    vi.restoreAllMocks();
});

describe("start", () => {
    it("schedules automatic update checks when no install has failed", async () => {
        await start("https://feed.example/");

        expect(setFeedURL).toHaveBeenCalled();
        expect(setIntervalSpy).toHaveBeenCalled();
    });

    it("stops checking automatically once installs have repeatedly failed", async () => {
        givenStore({ failedUpdateInstalls: 2 });

        await start("https://feed.example/");

        // The whole point of #32404: don't re-download the same update on every launch forever.
        expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it("still sets the feed URL when paused, so a manual check can recover", async () => {
        givenStore({ failedUpdateInstalls: 2 });

        await start("https://feed.example/");

        // Without a feed URL the user would be permanently stuck with no way to retry.
        expect(setFeedURL).toHaveBeenCalled();
    });

    it("keeps checking after a single failure", async () => {
        givenStore({ failedUpdateInstalls: 1 });

        await start("https://feed.example/");

        // One failure is not proof of an unfixable install: the user may simply have dismissed the
        // macOS authorization prompt that Squirrel.Mac shows for a privileged install.
        expect(setIntervalSpy).toHaveBeenCalled();
    });

    it("counts an update that did not take effect as a failed install", async () => {
        givenStore({ pendingUpdateVersion: "1.1.0", failedUpdateInstalls: 0 });
        getVersion.mockReturnValue("1.0.0"); // we asked for 1.1.0 but came back as 1.0.0

        await start("https://feed.example/");

        expect(storeSet).toHaveBeenCalledWith("failedUpdateInstalls", 1);
        expect(storeDelete).toHaveBeenCalledWith("pendingUpdateVersion");
    });

    it("clears the failure count when the update did take effect", async () => {
        givenStore({ pendingUpdateVersion: "1.0.0", failedUpdateInstalls: 1 });
        getVersion.mockReturnValue("1.0.0"); // we came back as the version we asked for

        await start("https://feed.example/");

        expect(storeSet).toHaveBeenCalledWith("failedUpdateInstalls", 0);
        expect(setIntervalSpy).toHaveBeenCalled();
    });

    it("does not count a downloaded-but-never-installed update as a failure", async () => {
        // No pendingUpdateVersion means the user never triggered an install, so there is nothing to
        // reconcile — recording it at download time instead would misread this as a failure.
        givenStore({ failedUpdateInstalls: 0 });

        await start("https://feed.example/");

        expect(storeSet).not.toHaveBeenCalled();
        expect(setIntervalSpy).toHaveBeenCalled();
    });

    it("pauses on the second consecutive failure", async () => {
        givenStore({ pendingUpdateVersion: "1.1.0", failedUpdateInstalls: 1 });
        getVersion.mockReturnValue("1.0.0");

        await start("https://feed.example/");

        expect(storeSet).toHaveBeenCalledWith("failedUpdateInstalls", 2);
        expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it("uses the plain Squirrel feed on Windows", async () => {
        setPlatform("win32");

        await start("https://feed.example/");

        // Windows has no `serverType`, and nothing here probes the install location on any platform.
        expect(setFeedURL).toHaveBeenCalledWith(expect.objectContaining({ serverType: undefined }));
    });
});

describe("install_update", () => {
    it("records the version handed to the updater so the next launch can verify it", () => {
        // Simulate an update having been downloaded, then the user choosing to install it.
        updaterListeners.get("update-downloaded")?.({}, "release notes", "1.1.0", new Date(), "https://example/update");

        ipcHandler("install_update")();

        expect(storeSet).toHaveBeenCalledWith("pendingUpdateVersion", "1.1.0");
        expect(autoUpdater.quitAndInstall).toHaveBeenCalled();
    });
});

describe("check_updates", () => {
    it("clears the failure count so an explicit request always retries", () => {
        givenStore({ failedUpdateInstalls: 2 });

        ipcHandler("check_updates")();

        expect(storeSet).toHaveBeenCalledWith("failedUpdateInstalls", 0);
    });
});

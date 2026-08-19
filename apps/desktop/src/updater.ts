/*
Copyright 2016-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app, autoUpdater, ipcMain } from "electron";
import fs from "node:fs/promises";
import os from "node:os";

import { getSquirrelExecutable } from "./squirrelhooks.js";
import { _t } from "./language-helper.js";
import { initialisePromise } from "./ipc.js";
import { getConfig } from "./config.js";
import Store from "./store.js";

const UPDATE_POLL_INTERVAL_MS = 60 * 60 * 1000;
const INITIAL_UPDATE_DELAY_MS = 30 * 1000;

/**
 * How many consecutive install attempts may provably fail before we stop automatically downloading the
 * same update on every launch. A single failure isn't worth acting on: a user who quits mid-handover,
 * or who dismisses the macOS authorization prompt once, should still have the update retried.
 */
const MAX_FAILED_INSTALLS = 2;

function installUpdate(): void {
    // for some reason, quitAndInstall does not fire the
    // before-quit event, so we need to set the flag here.
    global.appQuitting = true;
    // Record what we handed to the updater so the next launch can tell whether it actually landed.
    // This is deliberately recorded at install time rather than at download time: an update which was
    // downloaded but never installed (because the user simply hasn't restarted) is not a failure.
    Store.instance?.set("pendingUpdateVersion", latestUpdateDownloaded?.releaseName);
    autoUpdater.quitAndInstall();
}

// Workaround for Squirrel.Mac wedging auto-restart if latest check for update failed
// From https://github.com/vector-im/element-web/issues/12433#issuecomment-1508995119
async function safeCheckForUpdate(): Promise<void> {
    if (process.platform === "darwin") {
        const feedUrl = autoUpdater.getFeedURL();
        // On Mac if the user has already downloaded an update but not installed it and
        // we check again and no additional new update is available the app ends up in a
        // bad state and doesn't restart after installing any updates that are downloaded.
        // To avoid this we check manually whether an update is available and call the
        // autoUpdater.checkForUpdates() when something new is there.
        try {
            const res = await fetch(feedUrl);
            const { currentRelease } = (await res.json()) as { currentRelease: string };
            const latestVersionDownloaded = latestUpdateDownloaded?.releaseName;
            console.info(
                `Latest version from release download: ${currentRelease} (current: ${app.getVersion()}, most recent downloaded ${latestVersionDownloaded}})`,
            );
            if (currentRelease === app.getVersion() || currentRelease === latestVersionDownloaded) {
                ipcChannelSendUpdateStatus(false);
                return;
            }
        } catch (err) {
            console.error(`Error checking for updates ${feedUrl}`, err);
            ipcChannelSendUpdateStatus(false);
            return;
        }
    }
    autoUpdater.checkForUpdates();
}

async function pollForUpdates(): Promise<void> {
    try {
        // If we've already got a new update downloaded, then stop trying to check for new ones, as according to the doc
        // at https://github.com/electron/electron/blob/main/docs/api/auto-updater.md#autoupdatercheckforupdates
        // we'll just keep re-downloading the same update.
        // As a hunch, this might also be causing https://github.com/vector-im/element-web/issues/12433
        // due to the update checks colliding with the pending install somehow
        if (!latestUpdateDownloaded) {
            await safeCheckForUpdate();
        } else {
            console.log("Skipping update check as download already present");
            global.mainWindow?.webContents.send("update-downloaded", latestUpdateDownloaded);
        }
    } catch (e) {
        console.log("Couldn't check for update", e);
    }
}

export async function start(updateBaseUrl: string): Promise<void> {
    if (!(await available())) return;
    console.log(`Starting auto update with base URL: ${updateBaseUrl}`);
    if (!updateBaseUrl.endsWith("/")) {
        updateBaseUrl = updateBaseUrl + "/";
    }

    try {
        let url: string;
        let serverType: "json" | undefined;

        if (process.platform === "darwin") {
            // On macOS it takes a JSON file with a map between versions and their URLs
            url = `${updateBaseUrl}macos/releases.json`;
            serverType = "json";
        } else if (process.platform === "win32") {
            // On windows it takes a base path and looks for files under that path.
            url = `${updateBaseUrl}win32/${process.arch}/`;
        } else {
            // Squirrel / electron only supports auto-update on these two platforms.
            // I'm not even going to try to guess which feed style they'd use if they
            // implemented it on Linux, or if it would be different again.
            return;
        }

        if (url) {
            console.log(`Update URL: ${url}`);
            autoUpdater.setFeedURL({ url, serverType });

            // Downloading an update which then fails to install achieves nothing but spending the
            // user's bandwidth, and without this we would do it again on every single launch, forever
            // (#32404). Once we have proof that it keeps failing, stop checking automatically. The feed
            // URL is still set above, so a manual check from Settings continues to work and clears this.
            if (reconcileInstallAttempt() >= MAX_FAILED_INSTALLS) {
                console.warn("Automatic update checks paused: recent updates failed to install");
                return;
            }

            // We check for updates ourselves rather than using 'updater' because we need to
            // do it in the main process (and we don't really need to check every 10 minutes:
            // every hour should be just fine for a desktop app)
            // However, we still let the main window listen for the update events.
            // We also wait a short time before checking for updates the first time because
            // of squirrel on windows and it taking a small amount of time to release a
            // lock file.
            setTimeout(pollForUpdates, INITIAL_UPDATE_DELAY_MS);
            setInterval(pollForUpdates, UPDATE_POLL_INTERVAL_MS);
        }
    } catch (err) {
        // will fail if running in debug mode
        console.log("Couldn't enable update checking", err);
    }
}

/**
 * Reconcile the previous launch's install attempt, if there was one.
 *
 * Electron's autoUpdater cannot report a failed *install* on macOS: Squirrel.Mac hands off to a separate
 * ShipIt process after the app has already quit, so nothing is left running to observe the outcome and
 * the `error` event never fires (electron/electron#8912). The one signal that always survives is the
 * version we come back as — if we asked to install `x` and relaunched as anything else, it didn't take.
 *
 * This deliberately says nothing about *why* an install failed. In particular it does not check whether
 * the install location is writable: Squirrel.Mac already makes that exact check itself and responds by
 * escalating to a privileged install behind a native macOS authorization prompt, so second-guessing it
 * here would both duplicate its logic and pre-empt the prompt that lets the update succeed.
 *
 * @returns The number of consecutive install attempts which provably did not take effect.
 */
function reconcileInstallAttempt(): number {
    const store = Store.instance;
    if (!store) return 0;

    const pendingVersion = store.get("pendingUpdateVersion");
    if (pendingVersion === undefined) return store.get("failedUpdateInstalls") ?? 0;
    store.delete("pendingUpdateVersion");

    if (pendingVersion === app.getVersion()) {
        // We came back as the version we asked for, so it installed and any earlier failure was transient.
        store.set("failedUpdateInstalls", 0);
        return 0;
    }

    const failures = (store.get("failedUpdateInstalls") ?? 0) + 1;
    store.set("failedUpdateInstalls", failures);
    console.warn(
        `Update to ${pendingVersion} did not install, still running ${app.getVersion()} ` +
            `(${failures} consecutive failure(s))`,
    );
    return failures;
}

/**
 * Check for updates at the user's explicit request, overriding any pause applied by `start`. Someone who
 * deliberately asks should always get an attempt, and it gives them a way out if the pause was wrong.
 */
function manuallyCheckForUpdates(): void {
    Store.instance?.set("failedUpdateInstalls", 0);
    void pollForUpdates();
}

/**
 * Check if auto update is available on this platform.
 * Has a side effect of firing showToast on EOL platforms so must only be called once!
 * @returns True if auto update is available
 */
async function available(): Promise<boolean> {
    if (process.platform === "linux") {
        // Auto update is not supported on Linux
        console.warn("Auto update not supported on this platform");
        return false;
    }

    if (process.platform === "win32") {
        try {
            await fs.access(getSquirrelExecutable());
        } catch {
            console.warn("Squirrel not found, auto update not supported");
            return false;
        }
    }

    // Otherwise we're either on macOS or Windows with Squirrel
    if (process.platform === "darwin") {
        // OS release returns the Darwin kernel version, not the macOS version, see
        // https://en.wikipedia.org/wiki/Darwin_(operating_system)#Release_history to interpret it
        const release = os.release();
        const major = parseInt(release.split(".")[0], 10);

        if (major < 21) {
            // If the macOS version is too old for modern Electron support then disable auto update to prevent the app updating and bricking itself.
            // The oldest macOS version supported by Chromium/Electron 38 is Monterey (12.x) which started with Darwin 21.0
            await initialisePromise.then(() => {
                ipcMain.emit("showToast", {
                    title: _t("eol|title"),
                    description: _t("eol|no_more_updates", { brand: getConfig().brand }),
                });
            });
            console.warn("Auto update not supported, macOS version too old");
            return false;
        } else if (major < 22) {
            // If the macOS version is EOL then show a warning message.
            // The oldest macOS version still supported by Apple is Ventura (13.x) which started with Darwin 22.0
            await initialisePromise.then(() => {
                ipcMain.emit("showToast", {
                    title: _t("eol|title"),
                    description: _t("eol|warning", { brand: getConfig().brand }),
                });
            });
        }
    }

    return true;
}

ipcMain.on("install_update", installUpdate);
ipcMain.on("check_updates", manuallyCheckForUpdates);

function ipcChannelSendUpdateStatus(status: boolean | string): void {
    global.mainWindow?.webContents.send("check_updates", status);
}

interface ICachedUpdate {
    releaseNotes: string;
    releaseName: string;
    releaseDate: Date;
    updateURL: string;
}

// cache the latest update which has been downloaded as electron offers no api to read it
let latestUpdateDownloaded: ICachedUpdate | undefined;
autoUpdater
    .on("update-available", function () {
        ipcChannelSendUpdateStatus(true);
    })
    .on("update-not-available", function () {
        if (latestUpdateDownloaded) {
            // the only time we will get `update-not-available` if `latestUpdateDownloaded` is already set
            // is if the user used the Manual Update check and there is no update newer than the one we
            // have downloaded, so show it to them as the latest again.
            global.mainWindow?.webContents.send("update-downloaded", latestUpdateDownloaded);
        } else {
            ipcChannelSendUpdateStatus(false);
        }
    })
    .on("error", function (error) {
        ipcChannelSendUpdateStatus(error.message);
    });

autoUpdater.on("update-downloaded", (ev, releaseNotes, releaseName, releaseDate, updateURL) => {
    // forward to renderer
    latestUpdateDownloaded = { releaseNotes, releaseName, releaseDate, updateURL };
    global.mainWindow?.webContents.send("update-downloaded", latestUpdateDownloaded);
});

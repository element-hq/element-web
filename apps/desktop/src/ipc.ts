/*
Copyright 2022-2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app, autoUpdater, desktopCapturer, ipcMain, powerSaveBlocker, TouchBar, nativeImage } from "electron";

import IpcMainEvent = Electron.IpcMainEvent;
import { randomArray } from "./utils.js";
import {
    handleDisplayMediaPickerReply,
    handleScreenShareAudioSessionBinding,
    handleScreenShareAudioSessionRelease,
    supportsIsolatedScreenShareAudio,
} from "./display-media.js";
import Store, { clearDataAndRelaunch } from "./store.js";
import { getConfig } from "./config.js";

let focusHandlerAttached = false;
ipcMain.on("loudNotification", function (): void {
    if (process.platform === "win32" || process.platform === "linux") {
        if (global.mainWindow && !global.mainWindow.isFocused() && !focusHandlerAttached) {
            global.mainWindow.flashFrame(true);
            global.mainWindow.once("focus", () => {
                global.mainWindow?.flashFrame(false);
                focusHandlerAttached = false;
            });
            focusHandlerAttached = true;
        }
    }
});

ipcMain.handle("supportsIsolatedScreenShareAudio", () => supportsIsolatedScreenShareAudio());

interface Breadcrumb {
    roomId: string;
    avatarUrl: string | null;
    initial: string;
}

function setBreadcrumbsTouchBar(recents: Breadcrumb[]): void {
    if (process.platform !== "darwin") return;
    const { TouchBarPopover, TouchBarButton } = TouchBar;
    const recentsBar = new TouchBar({
        items: recents.map((recent) => {
            const defaultColors = ["#0DBD8B", "#368bd6", "#ac3ba8"];
            const total = recent.roomId.split("").reduce((sum, character) => sum + character.codePointAt(0)!, 0);
            const button = new TouchBarButton({
                label: recent.initial,
                backgroundColor: defaultColors[total % defaultColors.length],
                click: (): void => {
                    void global.mainWindow?.loadURL(`vector://vector/webapp/#/room/${recent.roomId}`);
                },
            });
            if (recent.avatarUrl) {
                void fetch(recent.avatarUrl)
                    .then((response) => {
                        if (!response.ok) return;
                        return response.arrayBuffer();
                    })
                    .then((arrayBuffer) => {
                        if (!arrayBuffer) return;
                        button.icon = nativeImage.createFromBuffer(Buffer.from(arrayBuffer));
                        button.label = "";
                        button.backgroundColor = "";
                    });
            }
            return button;
        }),
    });
    global.mainWindow?.setTouchBar(
        new TouchBar({
            items: [
                new TouchBarPopover({
                    label: "Recents",
                    showCloseButton: true,
                    items: recentsBar,
                }),
            ],
        }),
    );
}

async function getPickleKey(store: Store, key: string): Promise<string | null | undefined> {
    try {
        return await store.getSecret(key);
    } catch {
        // An error is thrown if safeStorage cannot initialise, or if a stored secret cannot be
        // decrypted this launch. Keep the secret so the session can recover on a later launch.
        // See element-web#32521 / #32715.
        return null;
    }
}

async function createPickleKey(store: Store, key: string): Promise<string | null> {
    try {
        // Never turn a transient keychain failure into permanent session and encryption-key loss.
        if (await store.isSecretUndecryptable(key)) {
            console.warn("Refusing to overwrite an existing undecryptable pickle key; preserving it");
            return null;
        }
        const pickleKey = await randomArray(32);
        await store.setSecret(key, pickleKey);
        return pickleKey;
    } catch (error) {
        console.error("Failed to create pickle key", error);
        return null;
    }
}

async function destroyPickleKey(store: Store, key: string): Promise<void> {
    try {
        await store.deleteSecret(key);
    } catch (error) {
        console.error("Failed to destroy pickle key", error);
    }
}

let powerSaveBlockerId: number | null = null;
ipcMain.on("app_onAction", function (_ev: IpcMainEvent, payload) {
    switch (payload.action) {
        case "call_state": {
            if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
                if (payload.state === "ended") {
                    powerSaveBlocker.stop(powerSaveBlockerId);
                    powerSaveBlockerId = null;
                }
            } else {
                if (powerSaveBlockerId === null && payload.state === "connected") {
                    powerSaveBlockerId = powerSaveBlocker.start("prevent-display-sleep");
                }
            }
            break;
        }
    }
});

ipcMain.on("ipcCall", async function (ev: IpcMainEvent, payload) {
    const store = Store.instance;
    if (!global.mainWindow || !store) return;

    const args = payload.args || [];
    let ret: any;

    switch (payload.name) {
        case "getUpdateFeedUrl":
            ret = autoUpdater.getFeedURL();
            break;
        case "setLanguage":
            global.appLocalization.setAppLocale(args[0]);
            break;
        case "getAppVersion":
            ret = app.getVersion();
            break;
        case "focusWindow":
            if (global.mainWindow.isMinimized()) {
                global.mainWindow.restore();
            } else {
                global.mainWindow.show();
                global.mainWindow.focus();
            }
            break;

        case "navigateBack":
            if (global.mainWindow.webContents.canGoBack()) {
                global.mainWindow.webContents.goBack();
            }
            break;
        case "navigateForward":
            if (global.mainWindow.webContents.canGoForward()) {
                global.mainWindow.webContents.goForward();
            }
            break;
        case "setSpellCheckEnabled":
            if (typeof args[0] !== "boolean") return;

            global.mainWindow.webContents.session.setSpellCheckerEnabled(args[0]);
            store.set("spellCheckerEnabled", args[0]);
            break;

        case "getSpellCheckEnabled":
            ret = store.get("spellCheckerEnabled");
            break;

        case "setSpellCheckLanguages":
            try {
                global.mainWindow.webContents.session.setSpellCheckerLanguages(args[0]);
            } catch (er) {
                console.log("There were problems setting the spellcheck languages", er);
            }
            break;

        case "getSpellCheckLanguages":
            ret = global.mainWindow.webContents.session.getSpellCheckerLanguages();
            break;
        case "getAvailableSpellCheckLanguages":
            ret = global.mainWindow.webContents.session.availableSpellCheckerLanguages;
            break;

        case "getPickleKey":
            ret = await getPickleKey(store, `${args[0]}|${args[1]}`);
            break;

        case "createPickleKey":
            ret = await createPickleKey(store, `${args[0]}|${args[1]}`);
            break;

        case "destroyPickleKey":
            await destroyPickleKey(store, `${args[0]}|${args[1]}`);
            break;
        case "getDesktopCapturerSources":
            ret = (await desktopCapturer.getSources(args[0])).map((source) => ({
                id: source.id,
                name: source.name,
                thumbnailURL: source.thumbnail.toDataURL(),
            }));
            break;
        case "callDisplayMediaCallback":
            handleDisplayMediaPickerReply(ev.sender.id, args[0]);
            ret = null;
            break;
        case "releaseScreenShareAudioSession":
            handleScreenShareAudioSessionRelease(ev.sender.id, args[0]);
            ret = null;
            break;
        case "bindScreenShareAudioSession":
            ret = handleScreenShareAudioSessionBinding(ev.sender.id, args[0]);
            break;

        case "clearStorage":
            await clearDataAndRelaunch(global.mainWindow.webContents.session);
            return; // the app is about to stop, we don't need to reply to the IPC

        case "breadcrumbs": {
            setBreadcrumbsTouchBar(args[0]);
            break;
        }

        default:
            global.mainWindow.webContents.send("ipcReply", {
                id: payload.id,
                error: "Unknown IPC Call: " + payload.name,
            });
            return;
    }

    global.mainWindow?.webContents.send("ipcReply", {
        id: payload.id,
        reply: ret,
    });
});

ipcMain.handle("getConfig", getConfig);

const initialisePromiseWithResolvers = Promise.withResolvers<void>();
export const initialisePromise = initialisePromiseWithResolvers.promise;

ipcMain.once("initialise", () => {
    initialisePromiseWithResolvers.resolve();
});

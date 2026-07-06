/*
Copyright 2022-2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    app,
    autoUpdater,
    desktopCapturer,
    // eslint-disable-next-line no-restricted-imports
    ipcMain,
    powerSaveBlocker,
    TouchBar,
    nativeImage,
    type IpcMainEvent,
    type IpcMainInvokeEvent,
} from "electron";
import { type IpcHandles, type RendererMainEvents, type MainRendererEvents } from "shared-types";

import { randomArray } from "./utils.js";
import { getDisplayMediaCallback, setDisplayMediaCallback } from "./displayMediaCallback.js";
import Store, { clearDataAndRelaunch } from "./store.js";
import { getConfig } from "./config.js";

type MaybePromise<T> = Promise<T> | T;

export const typedIpcMain = {
    handle: <K extends keyof IpcHandles>(
        channel: K,
        listener: (
            event: IpcMainInvokeEvent,
            ...args: Parameters<IpcHandles[K]>
        ) => MaybePromise<ReturnType<IpcHandles[K]>>,
    ): void => {
        ipcMain.handle(channel, listener as any);
    },

    emit: <K extends keyof MainRendererEvents>(channel: K, ...args: Parameters<MainRendererEvents[K]>): void => {
        ipcMain.emit(channel, ...args);
    },

    on: <K extends keyof RendererMainEvents>(
        channel: K,
        listener: (event: IpcMainEvent, ...args: Parameters<RendererMainEvents[K]>) => void,
    ): void => {
        ipcMain.on(channel, listener as any);
    },
    once: <K extends keyof RendererMainEvents>(
        channel: K,
        listener: (event: IpcMainEvent, ...args: Parameters<RendererMainEvents[K]>) => void,
    ): void => {
        ipcMain.once(channel, listener as any);
    },
};

let focusHandlerAttached = false;
typedIpcMain.on("loudNotification", function (): void {
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

let powerSaveBlockerId: number | null = null;
typedIpcMain.on("prevent_display_sleep", function (_ev, prevent) {
    if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId) && !prevent) {
        powerSaveBlocker.stop(powerSaveBlockerId);
        powerSaveBlockerId = null;
    } else if (powerSaveBlockerId === null && prevent) {
        powerSaveBlockerId = powerSaveBlocker.start("prevent-display-sleep");
    }
});

typedIpcMain.handle("getAppVersion", () => app.getVersion());
typedIpcMain.handle("setLanguage", (_, lang) => {
    global.appLocalization.setAppLocale(lang);
});
typedIpcMain.handle("focusWindow", () => {
    if (global.mainWindow?.isMinimized()) {
        global.mainWindow.restore();
    } else {
        global.mainWindow?.show();
        global.mainWindow?.focus();
    }
});
typedIpcMain.handle("getUpdateFeedUrl", () => autoUpdater.getFeedURL());
typedIpcMain.handle("navigateBack", () => {
    if (global.mainWindow?.webContents.canGoBack()) {
        global.mainWindow.webContents.goBack();
    }
});
typedIpcMain.handle("navigateForward", () => {
    if (global.mainWindow?.webContents.canGoForward()) {
        global.mainWindow.webContents.goForward();
    }
});
typedIpcMain.handle("setSpellCheckEnabled", (_, enabled) => {
    global.mainWindow?.webContents.session.setSpellCheckerEnabled(enabled);
    Store.instance?.set("spellCheckerEnabled", enabled);
});
typedIpcMain.handle("getSpellCheckEnabled", () => Store.instance?.get("spellCheckerEnabled") ?? false);
typedIpcMain.handle("setSpellCheckLanguages", (_, langs) => {
    try {
        global.mainWindow!.webContents.session.setSpellCheckerLanguages(langs);
    } catch (er) {
        console.log("There were problems setting the spellcheck languages", er);
    }
});
typedIpcMain.handle(
    "getSpellCheckLanguages",
    () => global.mainWindow?.webContents.session.getSpellCheckerLanguages() ?? [],
);
typedIpcMain.handle(
    "getAvailableSpellCheckLanguages",
    () => global.mainWindow?.webContents.session.availableSpellCheckerLanguages ?? [],
);
typedIpcMain.handle("getPickleKey", async (_, userId, deviceId) => {
    try {
        return (await Store.instance!.getSecret(`${userId}|${deviceId}`)) ?? null;
    } catch {
        // if an error is thrown (e.g. we can't initialise safeStorage),
        // then return null, which means the default pickle key will be used
        return null;
    }
});
typedIpcMain.handle("createPickleKey", async (_, userId, deviceId) => {
    try {
        const pickleKey = await randomArray(32);
        await Store.instance!.setSecret(`${userId}|${deviceId}`, pickleKey);
        return pickleKey;
    } catch (e) {
        console.error("Failed to create pickle key", e);
        return null;
    }
});
typedIpcMain.handle("destroyPickleKey", async (_, userId, deviceId) => {
    try {
        await Store.instance!.deleteSecret(`${userId}|${deviceId}`);
    } catch (e) {
        console.error("Failed to destroy pickle key", e);
    }
});
typedIpcMain.handle("getDesktopCapturerSources", async (_, options) => {
    const sources = await desktopCapturer.getSources(options);
    return sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnailURL: source.thumbnail.toDataURL(),
    }));
});
typedIpcMain.handle("callDisplayMediaCallback", async (_, video) => {
    await getDisplayMediaCallback()?.({ video });
    setDisplayMediaCallback(null);
});

typedIpcMain.once("clearStorage", () => {
    // the app is about to stop, we don't need to reply to the IPC
    clearDataAndRelaunch(global.mainWindow!.webContents.session);
});

if (process.platform === "darwin") {
    typedIpcMain.on("breadcrumbs", (_, rooms) => {
        const { TouchBarPopover, TouchBarButton } = TouchBar;

        const recentsBar = new TouchBar({
            items: rooms.map((r) => {
                const defaultColors = ["#0DBD8B", "#368bd6", "#ac3ba8"];
                let total = 0;
                for (let i = 0; i < r.roomId.length; ++i) {
                    total += r.roomId.charCodeAt(i);
                }

                const button = new TouchBarButton({
                    label: r.initial,
                    backgroundColor: defaultColors[total % defaultColors.length],
                    click: (): void => {
                        void global.mainWindow?.loadURL(`vector://vector/webapp/#/room/${r.roomId}`);
                    },
                });
                if (r.avatarUrl) {
                    void fetch(r.avatarUrl)
                        .then((resp) => {
                            if (!resp.ok) return;
                            return resp.arrayBuffer();
                        })
                        .then((arrayBuffer) => {
                            if (!arrayBuffer) return;
                            const buffer = Buffer.from(arrayBuffer);
                            button.icon = nativeImage.createFromBuffer(buffer);
                            button.label = "";
                            button.backgroundColor = "";
                        });
                }
                return button;
            }),
        });

        const touchBar = new TouchBar({
            items: [
                new TouchBarPopover({
                    label: "Recents",
                    showCloseButton: true,
                    items: recentsBar,
                }),
            ],
        });
        global.mainWindow?.setTouchBar(touchBar);
    });
}

typedIpcMain.handle("getConfig", getConfig);

const initialisePromiseWithResolvers = Promise.withResolvers<void>();
export const initialisePromise = initialisePromiseWithResolvers.promise;

typedIpcMain.once("initialise", () => {
    initialisePromiseWithResolvers.resolve();
});

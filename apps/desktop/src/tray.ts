/*
Copyright 2024-2025 New Vector Ltd.
Copyright 2017 Karl Glatz <karl@glatz.biz>
Copyright 2017 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app, Tray, Menu, nativeImage } from "electron";
import { v5 as uuidv5 } from "uuid";
import { writeFile } from "node:fs/promises";
import pngToIco from "png-to-ico";
import path from "node:path";

import { _t } from "./language-helper.js";

let trayIcon: Tray | null = null;

export function hasTray(): boolean {
    return trayIcon !== null;
}

export function destroy(): void {
    if (trayIcon) {
        trayIcon.destroy();
        trayIcon = null;
    }
}

function toggleWin(): void {
    if (global.mainWindow?.isVisible() && !global.mainWindow.isMinimized() && global.mainWindow.isFocused()) {
        global.mainWindow.hide();
    } else {
        if (global.mainWindow?.isMinimized()) global.mainWindow.restore();
        if (!global.mainWindow?.isVisible()) global.mainWindow?.show();
        global.mainWindow?.focus();
    }
}

function getUuid(): string {
    // The uuid field is optional and only needed on unsigned Windows packages where the executable path changes
    // The hardcoded uuid is an arbitrary v4 uuid generated on https://www.uuidgenerator.net/version4
    return global.vectorConfig["uuid"] || "eba84003-e499-4563-8e9d-166e34b5cc25";
}

export function create(config: (typeof global)["trayConfig"]): void {
    // no trays on darwin
    if (process.platform === "darwin" || trayIcon) return;
    const defaultIcon = nativeImage.createFromPath(config.icon_path);

    let guid: string | undefined;
    if (process.platform === "win32" && app.isPackaged) {
        // Providing a GUID lets Windows be smarter about maintaining user's tray preferences
        // https://github.com/electron/electron/pull/21891
        // Ideally we would only specify it for signed packages but determining whether the app is signed sufficiently
        // is non-trivial. So instead we have an escape hatch that unsigned packages can iterate the `uuid` in
        // config.json to prevent Windows refusing GUID-reuse if their executable path changes.
        guid = uuidv5(`${app.getName()}-${app.getPath("userData")}`, getUuid());
    }

    // Passing guid=undefined on Windows will cause it to throw `Error: Invalid GUID format`
    // The type here is wrong, the param must be omitted, never undefined.
    trayIcon = guid ? new Tray(defaultIcon, guid) : new Tray(defaultIcon);
    trayIcon.setToolTip(config.brand);
    initApplicationMenu();
    trayIcon.on("click", toggleWin);

    // See also, badge.ts
    let lastFavicon: string | null = null;
    global.mainWindow?.webContents.on("page-favicon-updated", async function (ev, favicons) {
        if (!favicons || favicons.length <= 0 || !favicons[0].startsWith("data:")) {
            if (lastFavicon !== null) {
                global.mainWindow?.setIcon(defaultIcon);
                trayIcon?.setImage(defaultIcon);
                lastFavicon = null;
            }
            return;
        }

        // No need to change, shortcut
        if (favicons[0] === lastFavicon) return;
        lastFavicon = favicons[0];

        let newFavicon = nativeImage.createFromDataURL(favicons[0]);

        // Windows likes ico's too much.
        if (process.platform === "win32") {
            try {
                const icoPath = path.join(app.getPath("temp"), "win32_element_icon.ico");
                await writeFile(icoPath, await pngToIco(newFavicon.toPNG()));
                newFavicon = nativeImage.createFromPath(icoPath);
            } catch (e) {
                console.error("Failed to make win32 ico", e);
            }
            // Always update the tray icon for Windows.
            trayIcon?.setImage(newFavicon);
        } else {
            trayIcon?.setImage(newFavicon);
            global.mainWindow?.setIcon(newFavicon);
        }
    });

    global.mainWindow?.webContents.on("page-title-updated", function (ev, title) {
        trayIcon?.setToolTip(title);
    });
}

export function initApplicationMenu(): void {
    if (!trayIcon) {
        return;
    }

    const contextMenu = Menu.buildFromTemplate([
        {
            label: _t("action|show_hide"),
            click: toggleWin,
        },
        { type: "separator" },
        {
            label: _t("action|quit"),
            click: function (): void {
                app.quit();
            },
        },
    ]);

    trayIcon.setContextMenu(contextMenu);
}

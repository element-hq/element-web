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
import { getBuildConfig } from "./build-config.js";
import { getBrand } from "./config.js";
import { getIconPath } from "./icon.js";

// This hardcoded uuid is an arbitrary v4 uuid generated on https://www.uuidgenerator.net/version4
const UUID_NAMESPACE = "9fc9c6a0-9ffe-45c9-9cd7-5639ae38b232";

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

export async function create(): Promise<void> {
    // no trays on darwin
    if (process.platform === "darwin" || trayIcon) return;
    const iconPath = await getIconPath();
    const defaultIcon = nativeImage.createFromPath(iconPath);

    const buildConfig = getBuildConfig();
    if (process.platform === "win32" && app.isPackaged && buildConfig.windowsCertSubjectName) {
        // Providing a GUID lets Windows be smarter about maintaining user's tray preferences
        // https://github.com/electron/electron/pull/21891
        // We generate the GUID in a custom arbitrary namespace and use the subject name & userData path
        // to differentiate different app builds on the same system.
        const guid = uuidv5(`${buildConfig.windowsCertSubjectName}:${app.getPath("userData")}`, UUID_NAMESPACE);
        trayIcon = new Tray(defaultIcon, guid);
    } else {
        trayIcon = new Tray(defaultIcon);
    }

    trayIcon.setToolTip(getBrand());
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

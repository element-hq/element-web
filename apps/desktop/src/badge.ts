/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app, nativeImage } from "electron";

import { _t } from "./language-helper.js";
import { typedIpcMain } from "./ipc.js";

// Handles calculating the correct "badge" for the window, for notifications and error states.
// Tray icon updates are handled in tray.ts

if (process.platform === "win32") {
    // We only use setOverlayIcon on Windows as it's only supported on that platform, but has good support
    // from all the Windows variants we support.
    // https://www.electronjs.org/docs/latest/api/browser-window#winsetoverlayiconoverlay-description-windows
    typedIpcMain.on("setBadgeCount", (_, count: number, imageBuffer?: ArrayBuffer, isError?: boolean): void => {
        if (count === 0) {
            // Flash frame is set to true in ipc.ts "loudNotification"
            global.mainWindow?.flashFrame(false);
        }
        if (imageBuffer) {
            global.mainWindow?.setOverlayIcon(
                nativeImage.createFromBuffer(Buffer.from(imageBuffer)),
                isError
                    ? _t("icon_overlay|description_error")
                    : _t("icon_overlay|description_notifications", { count }),
            );
        } else {
            global.mainWindow?.setOverlayIcon(null, "");
        }
    });
} else {
    // only set badgeCount on Mac/Linux, the docs say that only those platforms support it but turns out Electron
    // has some Windows support too, and in some Windows environments this leads to two badges rendering atop
    // each other. See https://github.com/vector-im/element-web/issues/16942
    typedIpcMain.on("setBadgeCount", function (_, count: number): void {
        if (count === 0) {
            // Flash frame is set to true in ipc.ts "loudNotification"
            global.mainWindow?.flashFrame(false);
        }
        app.badgeCount = count;
    });
}

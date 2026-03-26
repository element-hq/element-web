/*
Copyright 2022-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ipcMain } from "electron";

import * as tray from "./tray.js";
import Store from "./store.js";
import { AutoLaunch, type AutoLaunchState } from "./auto-launch.js";

interface Setting {
    read(): Promise<any>;
    write(value: any): Promise<void>;
    supported?(): boolean; // if undefined, the setting is always supported
}

const Settings: Record<string, Setting> = {
    "Electron.autoLaunch": {
        async read(): Promise<AutoLaunchState> {
            return AutoLaunch.instance.getState();
        },
        async write(value: AutoLaunchState): Promise<void> {
            return AutoLaunch.instance.setState(value);
        },
    },
    "Electron.warnBeforeExit": {
        async read(): Promise<any> {
            return Store.instance?.get("warnBeforeExit");
        },
        async write(value: any): Promise<void> {
            Store.instance?.set("warnBeforeExit", value);
        },
    },
    "Electron.alwaysShowMenuBar": {
        // This isn't relevant on Mac as Menu bars don't live in the app window
        supported(): boolean {
            return process.platform !== "darwin";
        },
        async read(): Promise<any> {
            return !global.mainWindow!.autoHideMenuBar;
        },
        async write(value: any): Promise<void> {
            Store.instance?.set("autoHideMenuBar", !value);
            global.mainWindow!.autoHideMenuBar = !value;
            global.mainWindow!.setMenuBarVisibility(value);
        },
    },
    "Electron.showTrayIcon": {
        // Things other than Mac support tray icons
        supported(): boolean {
            return process.platform !== "darwin";
        },
        async read(): Promise<any> {
            return tray.hasTray();
        },
        async write(value: any): Promise<void> {
            if (value) {
                // Create trayIcon icon
                tray.create(global.trayConfig);
            } else {
                tray.destroy();
            }
            Store.instance?.set("minimizeToTray", value);
        },
    },
    "Electron.enableHardwareAcceleration": {
        async read(): Promise<any> {
            return !Store.instance?.get("disableHardwareAcceleration");
        },
        async write(value: any): Promise<void> {
            Store.instance?.set("disableHardwareAcceleration", !value);
        },
    },
    "Electron.enableContentProtection": {
        // Unsupported on Linux https://www.electronjs.org/docs/latest/api/browser-window#winsetcontentprotectionenable-macos-windows
        // Broken on macOS https://github.com/electron/electron/issues/19880
        supported(): boolean {
            return process.platform === "win32";
        },
        async read(): Promise<any> {
            return Store.instance?.get("enableContentProtection");
        },
        async write(value: any): Promise<void> {
            global.mainWindow?.setContentProtection(value);
            Store.instance?.set("enableContentProtection", value);
        },
    },
};

ipcMain.handle("getSupportedSettings", async () => {
    const supportedSettings: Record<string, boolean> = {};
    for (const [key, setting] of Object.entries(Settings)) {
        supportedSettings[key] = setting.supported?.() ?? true;
    }
    return supportedSettings;
});
ipcMain.handle("setSettingValue", async (_ev, settingName: string, value: any) => {
    const setting = Settings[settingName];
    if (!setting) {
        throw new Error(`Unknown setting: ${settingName}`);
    }
    console.debug(`Writing setting value for: ${settingName} = ${value}`);
    await setting.write(value);
});
ipcMain.handle("getSettingValue", async (_ev, settingName: string) => {
    const setting = Settings[settingName];
    if (!setting) {
        throw new Error(`Unknown setting: ${settingName}`);
    }
    const value = await setting.read();
    console.debug(`Reading setting value for: ${settingName} = ${value}`);
    return value;
});

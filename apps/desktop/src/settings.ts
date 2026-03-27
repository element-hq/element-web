/*
Copyright 2022-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ipcMain } from "electron";

import * as tray from "./tray.js";
import Store from "./store.js";
import { AutoLaunch, type AutoLaunchState } from "./auto-launch.js";
import { type DesktopProxyConfig, applyProxyConfig } from "./proxy.js";

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
    "desktopProxyConfig": {
        async read(): Promise<DesktopProxyConfig> {
            const config = (Store.instance?.get("desktopProxyConfig") as DesktopProxyConfig) || { mode: "system" };
            if (config.mode === "custom") {
                const password = await Store.instance?.getSecret("proxy_password");
                if (password) {
                    config.password = password;
                }
            }
            return config;
        },
        async write(value: any): Promise<void> {
            if (!value || typeof value !== "object") value = { mode: "system" };
            if (!value.mode) value.mode = "system";

            const config = value as DesktopProxyConfig;
            if (config.mode === "custom" && config.password) {
                await Store.instance?.setSecret("proxy_password", config.password);
                delete config.password;
            } else {
                await Store.instance?.deleteSecret("proxy_password");
            }

            Store.instance?.set("desktopProxyConfig", config);
            await applyProxyConfig(config);
        },
    },
};

/**
 * Initializes the proxy from settings.
 */
export async function initProxy(): Promise<void> {
    console.log("[proxy] Initializing proxy from settings...");
    const stored = await Settings["desktopProxyConfig"].read();
    console.log("[proxy] Stored proxy config read:", JSON.stringify(stored));
    await applyProxyConfig(stored);
}

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

/*
Copyright 2024 New Vector Ltd.
Copyright 2018, 2019 , 2021 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// This file is compiled to CommonJS rather than ESM otherwise the browser chokes on the import statement.

import { ipcRenderer, contextBridge } from "electron";
import type {
    ElectronChannel,
    Electron,
    ElectronSettings,
    IpcHandles,
    MainRendererEvents,
    RendererMainEvents,
} from "shared-types" with {
    "resolution-mode": "import",
};
import type { ConfigOptions } from "./config.js" with { "resolution-mode": "import" };

// Expose only expected IPC wrapper APIs to the renderer process to avoid
// handing out generalised messaging access.

const CHANNELS: ElectronChannel[] = [
    "prevent_display_sleep",
    "before-quit",
    "check_updates",
    "install_update",
    "loudNotification",
    "preferences",
    "setBadgeCount",
    "update-downloaded",
    "userDownloadCompleted",
    "userDownloadAction",
    "openDesktopCapturerSourcePicker",
    "showToast",
    "getUpdateFeedUrl",
    "setLanguage",
    "getAppVersion",
    "focusWindow",
    "navigateBack",
    "navigateForward",
    "setSpellCheckEnabled",
    "getSpellCheckEnabled",
    "setSpellCheckLanguages",
    "getSpellCheckLanguages",
    "getAvailableSpellCheckLanguages",
    "getPickleKey",
    "createPickleKey",
    "destroyPickleKey",
    "getDesktopCapturerSources",
    "callDisplayMediaCallback",
    "clearStorage",
    "breadcrumbs",

    // Media auth
    "userAccessToken",
    "homeserverUrl",
    "serverSupportedVersions",

    // Seshat
    "seshat.supportsEventIndexing",
    "seshat.initEventIndex",
    "seshat.closeEventIndex",
    "seshat.deleteEventIndex",
    "seshat.isEventIndexEmpty",
    "seshat.isRoomIndexed",
    "seshat.addEventToIndex",
    "seshat.deleteEvent",
    "seshat.commitLiveEvents",
    "seshat.searchEventIndex",
    "seshat.addHistoricEvents",
    "seshat.getStats",
    "seshat.removeCrawlerCheckpoint",
    "seshat.addCrawlerCheckpoint",
    "seshat.loadFileEvents",
    "seshat.loadCheckpoints",
    "seshat.setUserVersion",
    "seshat.getUserVersion",
];

contextBridge.exposeInMainWorld("electron", {
    on<K extends keyof MainRendererEvents>(
        channel: K,
        listener: (...args: Parameters<MainRendererEvents[K]>) => void,
    ): void {
        if (!CHANNELS.includes(channel)) {
            throw new Error(`Unknown IPC channel ${channel} ignored`);
        }
        ipcRenderer.on(channel, (_, ...args: Parameters<MainRendererEvents[K]>) => listener(...args));
    },

    send<K extends keyof RendererMainEvents>(channel: K, ...args: Parameters<RendererMainEvents[K]>): void {
        if (!CHANNELS.includes(channel)) {
            throw new Error(`Unknown IPC channel ${channel} ignored`);
        }
        ipcRenderer.send(channel, ...args);
    },

    call<K extends keyof IpcHandles>(
        channel: K,
        ...args: Parameters<IpcHandles[K]>
    ): Promise<Awaited<ReturnType<IpcHandles[K]>>> {
        if (!CHANNELS.includes(channel)) {
            throw new Error(`Unknown IPC channel ${channel} ignored`);
        }
        return ipcRenderer.invoke(channel, ...args);
    },

    async initialise(): Promise<{
        protocol: string;
        sessionId: string;
        config: ConfigOptions;
        supportedSettings: Record<string, boolean>;
        /**
         * Do we need to render badge overlays for new notifications?
         */
        supportsBadgeOverlay: boolean;
    }> {
        ipcRenderer.emit("initialise");
        const [{ protocol, sessionId }, config, supportedSettings] = await Promise.all([
            ipcRenderer.invoke("getProtocol"),
            ipcRenderer.invoke("getConfig"),
            ipcRenderer.invoke("getSupportedSettings"),
        ]);
        return { protocol, sessionId, config, supportedSettings, supportsBadgeOverlay: process.platform === "win32" };
    },

    async setSettingValue<K extends keyof ElectronSettings>(settingName: K, value: ElectronSettings[K]): Promise<void> {
        return ipcRenderer.invoke("setSettingValue", settingName, value);
    },
    async getSettingValue<K extends keyof ElectronSettings>(settingName: K): Promise<ElectronSettings[K]> {
        return ipcRenderer.invoke("getSettingValue", settingName);
    },
} satisfies Electron);

export {};

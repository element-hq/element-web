/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { DesktopConfigJson } from "./config.json";

type Event<Params extends object = {}> = {
    preventDefault: () => void;
    readonly defaultPrevented: boolean;
} & Params;

export interface SeshatMatrixEvent {
    event_id: string;
    sender: string;
    room_id: string;
    type: string;
    origin_server_ts: number;
    content: Record<string, any>;
}

export interface SeshatMatrixProfile {
    displayname?: string;
    avatar_url?: string;
}

export interface SeshatCheckpoint {
    /** The room to be indexed */
    roomId: string;

    /** The pagination index to resume crawling from. */
    token: string;

    /**
     * If `fullCrawl` is false (or absent) and we find that we have already indexed the events we find, then we stop crawling.
     *
     * If `fullCrawl` is true, then we keep going until we reach the end of the room history.
     */
    fullCrawl?: boolean;

    /** Whether we should crawl in the forward or backward direction. */
    direction: "b" | "f";
}

export interface SeshatEventAndProfile {
    event: SeshatMatrixEvent;
    profile: SeshatMatrixProfile;
}

export interface SeshatSearchArgs {
    search_term: string;
    before_limit: number;
    after_limit: number;
    order_by_recency: boolean;
    room_id?: string;
    limit: number;
    next_batch?: string;
}

export interface SeshatIndexStats {
    size: number;
    eventCount: number;
    roomCount: number;
}

export interface SeshatLoadArgs {
    roomId: string;
    limit: number;
    fromEvent?: string;
    direction?: "b" | "f";
}

export interface SeshatSearchContext {
    events_before: SeshatMatrixEvent[];
    events_after: SeshatMatrixEvent[];
    profile_info: { [userId: string]: SeshatMatrixProfile };
}

export interface SeshatSearchResult {
    next_batch: string;
    count: number;
    results: {
        rank: number;
        result: SeshatMatrixEvent;
        context: SeshatSearchContext;
    }[];
}

// IPC definitions for Renderer->Main->Renderer calls
export interface IpcHandles {
    "getConfig"(): DesktopConfigJson;
    "getUpdateFeedUrl"(): string;
    "getAppVersion"(): string;
    "focusWindow"(): void;
    "navigateBack"(): void;
    "navigateForward"(): void;
    "setLanguage"(langs: string[]): void;
    "getUpdateFeedUrl"(): string;
    "setSpellCheckEnabled"(enabled: boolean): void;
    "getSpellCheckEnabled"(): boolean;
    "setSpellCheckLanguages"(langs: string[]): void;
    "getSpellCheckLanguages"(): string[];
    "getAvailableSpellCheckLanguages"(): string[];
    "getPickleKey"(userId: string, deviceId: string): string | null;
    "createPickleKey"(userId: string, deviceId: string): string | null;
    "destroyPickleKey"(userId: string, deviceId: string): void;
    "getDesktopCapturerSources"(options: GetSourcesOptions): DesktopCapturerSource[];
    "callDisplayMediaCallback"(video: DesktopCapturerSource): void;
    "getProtocol"(): {
        protocol: string;
        sessionId: string;
    };

    // Settings
    "getSupportedSettings"(): Record<keyof ElectronSettings, boolean>;
    "setSettingValue"<K extends keyof ElectronSettings>(settingName: K, value: ElectronSettings[K]): void;
    "getSettingValue"<K extends keyof ElectronSettings>(settingName: K): ElectronSettings[K];

    // Seshat
    "seshat.supportsEventIndexing"(): boolean;
    "seshat.initEventIndex"(userId: string, deviceId: string): void;
    "seshat.closeEventIndex"(): void;
    "seshat.deleteEventIndex"(): void;
    "seshat.isEventIndexEmpty"(): boolean;
    "seshat.isRoomIndexed"(roomId: string): boolean;
    "seshat.addEventToIndex"(matrixEvent: SeshatMatrixEvent, profile: SeshatMatrixProfile): void;
    "seshat.deleteEvent"(eventId: string): boolean;
    "seshat.commitLiveEvents"(): number;
    "seshat.searchEventIndex"(searchArgs: SeshatSearchArgs): SeshatSearchResult | undefined;
    "seshat.addHistoricEvents"(
        events: SeshatEventAndProfile[],
        newCheckpoint: SeshatCheckpoint | null,
        oldCheckpoint: SeshatCheckpoint | null,
    ): boolean;
    "seshat.getStats"(): SeshatIndexStats | undefined;
    "seshat.removeCrawlerCheckpoint"(checkpoint: SeshatCheckpoint): void;
    "seshat.addCrawlerCheckpoint"(checkpoint: SeshatCheckpoint): void;
    "seshat.loadFileEvents"(args: SeshatLoadArgs): SeshatEventAndProfile[];
    "seshat.loadCheckpoints"(): SeshatCheckpoint[];
    "seshat.setUserVersion"(version: number): void;
    "seshat.getUserVersion"(): number | undefined;
}

// Renderer -> Main events
export type RendererMainEvents = {
    "initialise"(): void;
    "loudNotification"(): void;
    "clearStorage"(): void;
    "breadcrumbs"(rooms: { roomId: string; avatarUrl: string | null; initial: string | undefined }[]): void;
    "setBadgeCount"(count: number, imageBuffer?: ArrayBuffer, isError?: boolean): void;
    "userDownloadAction"(download: { id: number; open?: boolean }): void;
    "install_update"(): void;
    "check_updates"(): void;
    "prevent_display_sleep"(prevent: boolean): void;
} & FlipCallAndResponse<CallAndResponse>;

// Main -> Renderer events
export type MainRendererEvents = {
    "showToast"(toast: { title: string; description: string; priority?: number }): void;
    "before-quit"(): void;
    "preferences"(): void;
    "openDesktopCapturerSourcePicker"(): void;
    "update-downloaded"(update: SquirrelUpdate): void;
    "userDownloadCompleted"(download: { id: number; name: string }): void;
    "check_updates"(status: boolean | string): void;
} & CallAndResponse;

type FlipCallAndResponse<T> = {
    [K in keyof T]: T[K] extends (...args: infer Args) => infer Ret ? (response: Ret) => Args : never;
};

export interface CallAndResponse {
    "userAccessToken"(): string | undefined;
    "homeserverUrl"(): string | undefined;
    "serverSupportedVersions"():
        | {
              versions: string[];
          }
        | undefined;
}

export type ElectronChannel = keyof IpcHandles | keyof RendererMainEvents | keyof MainRendererEvents;

export interface ElectronSettings {
    "Electron.autoLaunch": "enabled" | "minimised" | "disabled";
    "Electron.warnBeforeExit": boolean;
    "Electron.alwaysShowMenuBar": boolean;
    "Electron.showTrayIcon": boolean;
    "Electron.enableHardwareAcceleration": boolean;
    "Electron.enableContentProtection": boolean;
}

export interface SquirrelUpdate {
    releaseNotes: string;
    releaseName: string;
    releaseDate: Date;
    updateURL: string;
}

export interface Electron {
    on<K extends keyof MainRendererEvents>(
        channel: K,
        listener: (...args: Parameters<MainRendererEvents[K]>) => void,
    ): void;
    send<K extends keyof RendererMainEvents>(channel: K, ...args: Parameters<RendererMainEvents[K]>): void;

    // Renderer -> Main calls with return values back to Renderer
    call<K extends keyof IpcHandles>(
        command: K,
        ...args: Parameters<IpcHandles[K]>
    ): Promise<Awaited<ReturnType<IpcHandles[K]>>>;

    // Initialisation
    initialise(): Promise<{
        protocol: string;
        sessionId: string;
        supportsBadgeOverlay: boolean;
        config: DesktopConfigJson;
        supportedSettings: Record<string, boolean>;
    }>;

    // Settings
    setSettingValue<K extends keyof ElectronSettings>(settingName: K, value: ElectronSettings[K]): Promise<void>;
    getSettingValue<K extends keyof ElectronSettings>(settingName: K): Promise<ElectronSettings[K]>;
}

export interface DesktopCapturerSource {
    id: string;
    name: string;
    thumbnailURL: string;
}

export interface GetSourcesOptions {
    types: Array<"screen" | "window">;
    thumbnailSize?: {
        height: number;
        width: number;
    };
    fetchWindowIcons?: boolean;
}

declare global {
    interface Window {
        electron?: Electron;
    }
}

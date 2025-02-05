/*
Copyright 2024 New Vector Ltd.
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2018-2021 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type MatrixClient,
    type Room,
    type MatrixEvent,
    type OidcRegistrationClientMetadata,
} from "matrix-js-sdk/src/matrix";
import React from "react";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";
import { logger } from "matrix-js-sdk/src/logger";

import BasePlatform, { UpdateCheckStatus, type UpdateStatus } from "../../BasePlatform";
import type BaseEventIndexManager from "../../indexing/BaseEventIndexManager";
import dis from "../../dispatcher/dispatcher";
import SdkConfig from "../../SdkConfig";
import { type IConfigOptions } from "../../IConfigOptions";
import * as rageshake from "../../rageshake/rageshake";
import Modal from "../../Modal";
import InfoDialog from "../../components/views/dialogs/InfoDialog";
import Spinner from "../../components/views/elements/Spinner";
import { Action } from "../../dispatcher/actions";
import { type ActionPayload } from "../../dispatcher/payloads";
import { showToast as showUpdateToast } from "../../toasts/UpdateToast";
import { type CheckUpdatesPayload } from "../../dispatcher/payloads/CheckUpdatesPayload";
import ToastStore from "../../stores/ToastStore";
import GenericExpiringToast from "../../components/views/toasts/GenericExpiringToast";
import { BreadcrumbsStore } from "../../stores/BreadcrumbsStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import { avatarUrlForRoom, getInitialLetter } from "../../Avatar";
import DesktopCapturerSourcePicker from "../../components/views/elements/DesktopCapturerSourcePicker";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { SeshatIndexManager } from "./SeshatIndexManager";
import { IPCManager } from "./IPCManager";
import { _t } from "../../languageHandler";

interface SquirrelUpdate {
    releaseNotes: string;
    releaseName: string;
    releaseDate: Date;
    updateURL: string;
}

const SSO_ID_KEY = "element-desktop-ssoid";

const isMac = navigator.platform.toUpperCase().includes("MAC");

function platformFriendlyName(): string {
    // used to use window.process but the same info is available here
    if (navigator.userAgent.includes("Macintosh")) {
        return "macOS";
    } else if (navigator.userAgent.includes("FreeBSD")) {
        return "FreeBSD";
    } else if (navigator.userAgent.includes("OpenBSD")) {
        return "OpenBSD";
    } else if (navigator.userAgent.includes("SunOS")) {
        return "SunOS";
    } else if (navigator.userAgent.includes("Windows")) {
        return "Windows";
    } else if (navigator.userAgent.includes("Linux")) {
        return "Linux";
    } else {
        return "Unknown";
    }
}

function onAction(payload: ActionPayload): void {
    // Whitelist payload actions, no point sending most across
    if (["call_state"].includes(payload.action)) {
        window.electron!.send("app_onAction", payload);
    }
}

function getUpdateCheckStatus(status: boolean | string): UpdateStatus {
    if (status === true) {
        return { status: UpdateCheckStatus.Downloading };
    } else if (status === false) {
        return { status: UpdateCheckStatus.NotAvailable };
    } else {
        return {
            status: UpdateCheckStatus.Error,
            detail: status,
        };
    }
}

export default class ElectronPlatform extends BasePlatform {
    private readonly ipc = new IPCManager("ipcCall", "ipcReply");
    private readonly eventIndexManager: BaseEventIndexManager = new SeshatIndexManager();
    // this is the opaque token we pass to the HS which when we get it in our callback we can resolve to a profile
    private readonly ssoID: string = secureRandomString(32);

    public constructor() {
        super();

        if (!window.electron) {
            throw new Error("Cannot instantiate ElectronPlatform, window.electron is not set");
        }

        dis.register(onAction);
        /*
            IPC Call `check_updates` returns:
            true if there is an update available
            false if there is not
            or the error if one is encountered
         */
        window.electron.on("check_updates", (event, status) => {
            dis.dispatch<CheckUpdatesPayload>({
                action: Action.CheckUpdates,
                ...getUpdateCheckStatus(status),
            });
        });

        // `userAccessToken` (IPC) is requested by the main process when appending authentication
        // to media downloads. A reply is sent over the same channel.
        window.electron.on("userAccessToken", () => {
            window.electron!.send("userAccessToken", MatrixClientPeg.get()?.getAccessToken());
        });

        // `homeserverUrl` (IPC) is requested by the main process. A reply is sent over the same channel.
        window.electron.on("homeserverUrl", () => {
            window.electron!.send("homeserverUrl", MatrixClientPeg.get()?.getHomeserverUrl());
        });

        // `serverSupportedVersions` is requested by the main process when it needs to know if the
        // server supports a particular version. This is primarily used to detect authenticated media
        // support. A reply is sent over the same channel.
        window.electron.on("serverSupportedVersions", async () => {
            window.electron!.send("serverSupportedVersions", await MatrixClientPeg.get()?.getVersions());
        });

        // try to flush the rageshake logs to indexeddb before quit.
        window.electron.on("before-quit", function () {
            logger.log("element-desktop closing");
            rageshake.flush();
        });

        window.electron.on("update-downloaded", this.onUpdateDownloaded);

        window.electron.on("preferences", () => {
            dis.fire(Action.ViewUserSettings);
        });

        window.electron.on("userDownloadCompleted", (ev, { id, name }) => {
            const key = `DOWNLOAD_TOAST_${id}`;

            const onAccept = (): void => {
                window.electron!.send("userDownloadAction", { id, open: true });
                ToastStore.sharedInstance().dismissToast(key);
            };

            const onDismiss = (): void => {
                window.electron!.send("userDownloadAction", { id });
            };

            ToastStore.sharedInstance().addOrReplaceToast({
                key,
                title: _t("download_completed"),
                props: {
                    description: name,
                    primaryLabel: _t("action|open"),
                    onPrimaryClick: onAccept,
                    dismissLabel: _t("action|dismiss"),
                    onDismiss,
                    numSeconds: 10,
                },
                component: GenericExpiringToast,
                priority: 99,
            });
        });

        window.electron.on("openDesktopCapturerSourcePicker", async () => {
            const { finished } = Modal.createDialog(DesktopCapturerSourcePicker);
            const [source] = await finished;
            // getDisplayMedia promise does not return if no dummy is passed here as source
            await this.ipc.call("callDisplayMediaCallback", source ?? { id: "", name: "", thumbnailURL: "" });
        });

        void this.ipc.call("startSSOFlow", this.ssoID);

        BreadcrumbsStore.instance.on(UPDATE_EVENT, this.onBreadcrumbsUpdate);
    }

    public async getConfig(): Promise<IConfigOptions | undefined> {
        return this.ipc.call("getConfig");
    }

    private onBreadcrumbsUpdate = (): void => {
        const rooms = BreadcrumbsStore.instance.rooms.slice(0, 7).map((r) => ({
            roomId: r.roomId,
            avatarUrl: avatarUrlForRoom(
                r,
                Math.floor(60 * window.devicePixelRatio),
                Math.floor(60 * window.devicePixelRatio),
                "crop",
            ),
            initial: getInitialLetter(r.name),
        }));
        void this.ipc.call("breadcrumbs", rooms);
    };

    private onUpdateDownloaded = async (ev: Event, { releaseNotes, releaseName }: SquirrelUpdate): Promise<void> => {
        dis.dispatch<CheckUpdatesPayload>({
            action: Action.CheckUpdates,
            status: UpdateCheckStatus.Ready,
        });
        if (this.shouldShowUpdate(releaseName)) {
            showUpdateToast(await this.getAppVersion(), releaseName, releaseNotes);
        }
    };

    public getHumanReadableName(): string {
        return "Electron Platform"; // no translation required: only used for analytics
    }

    /**
     * Return true if platform supports multi-language
     * spell-checking, otherwise false.
     */
    public supportsSpellCheckSettings(): boolean {
        return true;
    }

    public allowOverridingNativeContextMenus(): boolean {
        return true;
    }

    public setNotificationCount(count: number): void {
        if (this.notificationCount === count) return;
        super.setNotificationCount(count);

        window.electron!.send("setBadgeCount", count);
    }

    public supportsNotifications(): boolean {
        return true;
    }

    public maySendNotifications(): boolean {
        return true;
    }

    public displayNotification(
        title: string,
        msg: string,
        avatarUrl: string,
        room: Room,
        ev?: MatrixEvent,
    ): Notification {
        // GNOME notification spec parses HTML tags for styling...
        // Electron Docs state all supported linux notification systems follow this markup spec
        // https://github.com/electron/electron/blob/master/docs/tutorial/desktop-environment-integration.md#linux
        // maybe we should pass basic styling (italics, bold, underline) through from MD
        // we only have to strip out < and > as the spec doesn't include anything about things like &amp;
        // so we shouldn't assume that all implementations will treat those properly. Very basic tag parsing is done.
        if (navigator.userAgent.includes("Linux")) {
            msg = msg.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }

        const notification = super.displayNotification(title, msg, avatarUrl, room, ev);

        const handler = notification.onclick as () => void;
        notification.onclick = (): void => {
            handler?.();
            void this.ipc.call("focusWindow");
        };

        return notification;
    }

    public loudNotification(ev: MatrixEvent, room: Room): void {
        window.electron!.send("loudNotification");
    }

    public needsUrlTooltips(): boolean {
        return true;
    }

    public async getAppVersion(): Promise<string> {
        return this.ipc.call("getAppVersion");
    }

    public supportsSetting(settingName?: string): boolean {
        switch (settingName) {
            case "Electron.showTrayIcon": // Things other than Mac support tray icons
            case "Electron.alwaysShowMenuBar": // This isn't relevant on Mac as Menu bars don't live in the app window
                return !isMac;
            default:
                return true;
        }
    }

    public getSettingValue(settingName: string): Promise<any> {
        return this.ipc.call("getSettingValue", settingName);
    }

    public setSettingValue(settingName: string, value: any): Promise<void> {
        return this.ipc.call("setSettingValue", settingName, value);
    }

    public async canSelfUpdate(): Promise<boolean> {
        const feedUrl = await this.ipc.call("getUpdateFeedUrl");
        return Boolean(feedUrl);
    }

    public startUpdateCheck(): void {
        super.startUpdateCheck();
        window.electron!.send("check_updates");
    }

    public installUpdate(): void {
        // IPC to the main process to install the update, since quitAndInstall
        // doesn't fire the before-quit event so the main process needs to know
        // it should exit.
        window.electron!.send("install_update");
    }

    public getDefaultDeviceDisplayName(): string {
        const brand = SdkConfig.get().brand;
        return _t("desktop_default_device_name", {
            brand,
            platformName: platformFriendlyName(),
        });
    }

    public requestNotificationPermission(): Promise<string> {
        return Promise.resolve("granted");
    }

    public reload(): void {
        window.location.reload();
    }

    public getEventIndexingManager(): BaseEventIndexManager | null {
        return this.eventIndexManager;
    }

    public async setLanguage(preferredLangs: string[]): Promise<any> {
        return this.ipc.call("setLanguage", preferredLangs);
    }

    public setSpellCheckEnabled(enabled: boolean): void {
        this.ipc.call("setSpellCheckEnabled", enabled).catch((error) => {
            logger.log("Failed to send setSpellCheckEnabled IPC to Electron");
            logger.error(error);
        });
    }

    public async getSpellCheckEnabled(): Promise<boolean> {
        return this.ipc.call("getSpellCheckEnabled");
    }

    public setSpellCheckLanguages(preferredLangs: string[]): void {
        this.ipc.call("setSpellCheckLanguages", preferredLangs).catch((error) => {
            logger.log("Failed to send setSpellCheckLanguages IPC to Electron");
            logger.error(error);
        });
    }

    public async getSpellCheckLanguages(): Promise<string[]> {
        return this.ipc.call("getSpellCheckLanguages");
    }

    public async getDesktopCapturerSources(options: GetSourcesOptions): Promise<Array<DesktopCapturerSource>> {
        return this.ipc.call("getDesktopCapturerSources", options);
    }

    public supportsDesktopCapturer(): boolean {
        return true;
    }

    public supportsJitsiScreensharing(): boolean {
        // See https://github.com/element-hq/element-web/issues/4880
        return false;
    }

    public async getAvailableSpellCheckLanguages(): Promise<string[]> {
        return this.ipc.call("getAvailableSpellCheckLanguages");
    }

    public getSSOCallbackUrl(fragmentAfterLogin?: string): URL {
        const url = super.getSSOCallbackUrl(fragmentAfterLogin);
        url.protocol = "element";
        url.searchParams.set(SSO_ID_KEY, this.ssoID);
        return url;
    }

    public startSingleSignOn(
        mxClient: MatrixClient,
        loginType: "sso" | "cas",
        fragmentAfterLogin: string,
        idpId?: string,
    ): void {
        // this will get intercepted by electron-main will-navigate
        super.startSingleSignOn(mxClient, loginType, fragmentAfterLogin, idpId);
        Modal.createDialog(InfoDialog, {
            title: _t("auth|sso_complete_in_browser_dialog_title"),
            description: <Spinner />,
        });
    }

    public navigateForwardBack(back: boolean): void {
        void this.ipc.call(back ? "navigateBack" : "navigateForward");
    }

    public overrideBrowserShortcuts(): boolean {
        return true;
    }

    public async getPickleKey(userId: string, deviceId: string): Promise<string | null> {
        try {
            return await this.ipc.call("getPickleKey", userId, deviceId);
        } catch {
            // if we can't connect to the password storage, assume there's no
            // pickle key
            return null;
        }
    }

    public async createPickleKey(userId: string, deviceId: string): Promise<string | null> {
        try {
            return await this.ipc.call("createPickleKey", userId, deviceId);
        } catch {
            // if we can't connect to the password storage, assume there's no
            // pickle key
            return null;
        }
    }

    public async destroyPickleKey(userId: string, deviceId: string): Promise<void> {
        try {
            await this.ipc.call("destroyPickleKey", userId, deviceId);
        } catch {}
    }

    public async clearStorage(): Promise<void> {
        try {
            await super.clearStorage();
            await this.ipc.call("clearStorage");
        } catch {}
    }

    public get baseUrl(): string {
        // This configuration is element-desktop specific so the types here do not know about it
        return (SdkConfig.get() as unknown as Record<string, string>)["web_base_url"] ?? "https://app.element.io";
    }

    public get defaultOidcClientUri(): string {
        // Default to element.io as our scheme `io.element.desktop` is within its scope on default MAS policies
        return "https://element.io";
    }

    public async getOidcClientMetadata(): Promise<OidcRegistrationClientMetadata> {
        const baseMetadata = await super.getOidcClientMetadata();
        return {
            ...baseMetadata,
            applicationType: "native",
        };
    }

    public getOidcClientState(): string {
        return `:${SSO_ID_KEY}:${this.ssoID}`;
    }

    /**
     * The URL to return to after a successful OIDC authentication
     */
    public getOidcCallbackUrl(): URL {
        const url = super.getOidcCallbackUrl();
        url.protocol = "io.element.desktop";
        // Trim the double slash into a single slash to comply with https://datatracker.ietf.org/doc/html/rfc8252#section-7.1
        if (url.href.startsWith(`${url.protocol}://`)) {
            url.href = url.href.replace("://", ":/");
        }
        return url;
    }
}

/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type MatrixClient,
    type MatrixEvent,
    type Room,
    type SSOAction,
    encodeUnpaddedBase64,
    type OidcRegistrationClientMetadata,
    MatrixEventEvent,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import dis from "./dispatcher/dispatcher";
import type BaseEventIndexManager from "./indexing/BaseEventIndexManager";
import { type ActionPayload } from "./dispatcher/payloads";
import { type CheckUpdatesPayload } from "./dispatcher/payloads/CheckUpdatesPayload";
import { Action } from "./dispatcher/actions";
import { hideToast as hideUpdateToast } from "./toasts/UpdateToast";
import { MatrixClientPeg } from "./MatrixClientPeg";
import { idbLoad, idbSave, idbDelete } from "./utils/StorageAccess";
import { type ViewRoomPayload } from "./dispatcher/payloads/ViewRoomPayload";
import { type IConfigOptions } from "./IConfigOptions";
import SdkConfig from "./SdkConfig";
import { buildAndEncodePickleKey, encryptPickleKey } from "./utils/tokens/pickling";
import Favicon from "./favicon.ts";
import { getVectorConfig } from "./vector/getconfig.ts";

export const SSO_HOMESERVER_URL_KEY = "mx_sso_hs_url";
export const SSO_ID_SERVER_URL_KEY = "mx_sso_is_url";
export const SSO_IDP_ID_KEY = "mx_sso_idp_id";

export enum UpdateCheckStatus {
    Checking = "CHECKING",
    Error = "ERROR",
    NotAvailable = "NOTAVAILABLE",
    Downloading = "DOWNLOADING",
    Ready = "READY",
}

export interface UpdateStatus {
    /**
     * The current phase of the manual update check.
     */
    status: UpdateCheckStatus;
    /**
     * Detail string relating to the current status, typically for error details.
     */
    detail?: string;
}

const UPDATE_DEFER_KEY = "mx_defer_update";

/**
 * Base class for classes that provide platform-specific functionality
 * eg. Setting an application badge or displaying notifications
 *
 * Instances of this class are provided by the application.
 */
export default abstract class BasePlatform {
    protected notificationCount = 0;
    protected errorDidOccur = false;
    protected _favicon?: Favicon;

    protected constructor() {
        dis.register(this.onAction);
        this.startUpdateCheck = this.startUpdateCheck.bind(this);
    }

    public async getConfig(): Promise<IConfigOptions | undefined> {
        return getVectorConfig();
    }

    /**
     * Get a sensible default display name for the device Element is running on
     */
    public abstract getDefaultDeviceDisplayName(): string;

    protected onAction = (payload: ActionPayload): void => {
        switch (payload.action) {
            case "on_client_not_viable":
            case Action.OnLoggedOut:
                this.setNotificationCount(0);
                break;
        }
    };

    // Used primarily for Analytics
    public abstract getHumanReadableName(): string;

    public setNotificationCount(count: number): void {
        if (this.notificationCount === count) return;
        this.notificationCount = count;
        this.updateFavicon();
    }

    public setErrorStatus(errorDidOccur: boolean): void {
        if (this.errorDidOccur === errorDidOccur) return;
        this.errorDidOccur = errorDidOccur;
        this.updateFavicon();
    }

    /**
     * Whether we can call checkForUpdate on this platform build
     */
    public async canSelfUpdate(): Promise<boolean> {
        return false;
    }

    public startUpdateCheck(): void {
        hideUpdateToast();
        localStorage.removeItem(UPDATE_DEFER_KEY);
        dis.dispatch<CheckUpdatesPayload>({
            action: Action.CheckUpdates,
            status: UpdateCheckStatus.Checking,
        });
    }

    /**
     * Update the currently running app to the latest available version
     * and replace this instance of the app with the new version.
     */
    public installUpdate(): void {}

    /**
     * Check if the version update has been deferred and that deferment is still in effect
     * @param newVersion the version string to check
     */
    protected shouldShowUpdate(newVersion: string): boolean {
        // If the user registered on this client in the last 24 hours then do not show them the update toast
        if (MatrixClientPeg.userRegisteredWithinLastHours(24)) return false;

        try {
            const [version, deferUntil] = JSON.parse(localStorage.getItem(UPDATE_DEFER_KEY)!);
            return newVersion !== version || Date.now() > deferUntil;
        } catch {
            return true;
        }
    }

    /**
     * Ignore the pending update and don't prompt about this version
     * until the next morning (8am).
     */
    public deferUpdate(newVersion: string): void {
        const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
        date.setHours(8, 0, 0, 0); // set to next 8am
        localStorage.setItem(UPDATE_DEFER_KEY, JSON.stringify([newVersion, date.getTime()]));
        hideUpdateToast();
    }

    /**
     * Return true if platform supports multi-language
     * spell-checking, otherwise false.
     */
    public supportsSpellCheckSettings(): boolean {
        return false;
    }

    /**
     * Returns true if platform allows overriding native context menus
     */
    public allowOverridingNativeContextMenus(): boolean {
        return false;
    }

    /**
     * Returns true if the platform supports displaying
     * notifications, otherwise false.
     * @returns {boolean} whether the platform supports displaying notifications
     */
    public supportsNotifications(): boolean {
        return false;
    }

    /**
     * Returns true if the application currently has permission
     * to display notifications. Otherwise false.
     * @returns {boolean} whether the application has permission to display notifications
     */
    public maySendNotifications(): boolean {
        return false;
    }

    /**
     * Requests permission to send notifications. Returns
     * a promise that is resolved when the user has responded
     * to the request. The promise has a single string argument
     * that is 'granted' if the user allowed the request or
     * 'denied' otherwise.
     */
    public abstract requestNotificationPermission(): Promise<string>;

    public displayNotification(
        title: string,
        msg: string,
        avatarUrl: string | null,
        room: Room,
        ev?: MatrixEvent,
    ): Notification {
        const notifBody: NotificationOptions = {
            body: msg,
            silent: true, // we play our own sounds
        };
        if (avatarUrl) notifBody["icon"] = avatarUrl;
        const notification = new window.Notification(title, notifBody);

        notification.onclick = () => {
            const payload: ViewRoomPayload = {
                action: Action.ViewRoom,
                room_id: room.roomId,
                metricsTrigger: "Notification",
            };

            if (ev?.getThread()) {
                payload.event_id = ev.getId();
            }

            dis.dispatch(payload);
            window.focus();
        };

        const closeHandler = (): void => notification.close();

        // Clear a notification from a redacted event.
        if (ev) {
            ev.once(MatrixEventEvent.BeforeRedaction, closeHandler);
            notification.onclose = () => {
                ev.off(MatrixEventEvent.BeforeRedaction, closeHandler);
            };
        }

        return notification;
    }

    public loudNotification(ev: MatrixEvent, room: Room): void {}

    public clearNotification(notif: Notification): void {
        // Some browsers don't support this, e.g Safari on iOS
        // https://developer.mozilla.org/en-US/docs/Web/API/Notification/close
        if (notif.close) {
            notif.close();
        }
    }

    /**
     * Returns true if the platform requires URL previews in tooltips, otherwise false.
     * @returns {boolean} whether the platform requires URL previews in tooltips
     */
    public needsUrlTooltips(): boolean {
        return false;
    }

    /**
     * Returns a promise that resolves to a string representing the current version of the application.
     */
    public abstract getAppVersion(): Promise<string>;

    /**
     * Restarts the application, without necessarily reloading
     * any application code
     */
    public abstract reload(): void;

    public supportsSetting(settingName?: string): boolean {
        return false;
    }

    public async getSettingValue(settingName: string): Promise<any> {
        return undefined;
    }

    public setSettingValue(settingName: string, value: any): Promise<void> {
        throw new Error("Unimplemented");
    }

    /**
     * Get our platform specific EventIndexManager.
     *
     * @return {BaseEventIndexManager} The EventIndex manager for our platform,
     * can be null if the platform doesn't support event indexing.
     */
    public getEventIndexingManager(): BaseEventIndexManager | null {
        return null;
    }

    public setLanguage(preferredLangs: string[]): void {}

    public setSpellCheckEnabled(enabled: boolean): void {}

    public async getSpellCheckEnabled(): Promise<boolean> {
        return false;
    }

    public setSpellCheckLanguages(preferredLangs: string[]): void {}

    public getSpellCheckLanguages(): Promise<string[]> | null {
        return null;
    }

    public async getDesktopCapturerSources(options: GetSourcesOptions): Promise<Array<DesktopCapturerSource>> {
        return [];
    }

    public supportsDesktopCapturer(): boolean {
        return false;
    }

    public supportsJitsiScreensharing(): boolean {
        return true;
    }

    public overrideBrowserShortcuts(): boolean {
        return false;
    }

    public navigateForwardBack(back: boolean): void {}

    public getAvailableSpellCheckLanguages(): Promise<string[]> | null {
        return null;
    }

    /**
     * The URL to return to after a successful SSO authentication
     * @param fragmentAfterLogin optional fragment for specific view to return to
     */
    public getSSOCallbackUrl(fragmentAfterLogin = ""): URL {
        const url = new URL(window.location.href);
        url.hash = fragmentAfterLogin;
        return url;
    }

    /**
     * Begin Single Sign On flows.
     * @param {MatrixClient} mxClient the matrix client using which we should start the flow
     * @param {"sso"|"cas"} loginType the type of SSO it is, CAS/SSO.
     * @param {string} fragmentAfterLogin the hash to pass to the app during sso callback.
     * @param {SSOAction} action the SSO flow to indicate to the IdP, optional.
     * @param {string} idpId The ID of the Identity Provider being targeted, optional.
     */
    public startSingleSignOn(
        mxClient: MatrixClient,
        loginType: "sso" | "cas",
        fragmentAfterLogin?: string,
        idpId?: string,
        action?: SSOAction,
    ): void {
        // persist hs url and is url for when the user is returned to the app with the login token
        localStorage.setItem(SSO_HOMESERVER_URL_KEY, mxClient.getHomeserverUrl());
        if (mxClient.getIdentityServerUrl()) {
            localStorage.setItem(SSO_ID_SERVER_URL_KEY, mxClient.getIdentityServerUrl()!);
        }
        if (idpId) {
            localStorage.setItem(SSO_IDP_ID_KEY, idpId);
        }
        const callbackUrl = this.getSSOCallbackUrl(fragmentAfterLogin);
        window.location.href = mxClient.getSsoLoginUrl(callbackUrl.toString(), loginType, idpId, action); // redirect to SSO
    }

    /**
     * Get a previously stored pickle key.  The pickle key is used for
     * encrypting libolm objects and react-sdk-crypto data.
     * @param {string} userId the user ID for the user that the pickle key is for.
     * @param {string} deviceId the device ID that the pickle key is for.
     * @returns {string|null} the previously stored pickle key, or null if no
     *     pickle key has been stored.
     */
    public async getPickleKey(userId: string, deviceId: string): Promise<string | null> {
        let data: { encrypted?: BufferSource; iv?: BufferSource; cryptoKey?: CryptoKey } | undefined;
        try {
            data = await idbLoad("pickleKey", [userId, deviceId]);
        } catch (e) {
            logger.error("idbLoad for pickleKey failed", e);
        }

        return (await buildAndEncodePickleKey(data, userId, deviceId)) ?? null;
    }

    /**
     * Create and store a pickle key for encrypting libolm objects.
     * @param {string} userId the user ID for the user that the pickle key is for.
     * @param {string} deviceId the device ID that the pickle key is for.
     * @returns {string|null} the pickle key, or null if the platform does not
     *     support storing pickle keys.
     */
    public async createPickleKey(userId: string, deviceId: string): Promise<string | null> {
        const randomArray = new Uint8Array(32);
        crypto.getRandomValues(randomArray);
        const data = await encryptPickleKey(randomArray, userId, deviceId);
        if (data === undefined) {
            // no crypto support
            return null;
        }

        try {
            await idbSave("pickleKey", [userId, deviceId], data);
        } catch {
            return null;
        }
        return encodeUnpaddedBase64(randomArray);
    }

    /**
     * Delete a previously stored pickle key from storage.
     * @param {string} userId the user ID for the user that the pickle key is for.
     * @param {string} deviceId the device ID that the pickle key is for.
     */
    public async destroyPickleKey(userId: string, deviceId: string): Promise<void> {
        try {
            await idbDelete("pickleKey", [userId, deviceId]);
        } catch (e) {
            logger.error("idbDelete failed in destroyPickleKey", e);
        }
    }

    /**
     * Clear app storage, called when logging out to perform data clean up.
     */
    public async clearStorage(): Promise<void> {
        window.sessionStorage.clear();
        window.localStorage.clear();
    }

    /**
     * Base URL to use when generating external links for this client, for platforms e.g. Desktop this will be a different instance
     */
    public get baseUrl(): string {
        return window.location.origin + window.location.pathname;
    }

    /**
     * Fallback Client URI to use for OIDC client registration for if one is not specified in config.json
     */
    public get defaultOidcClientUri(): string {
        return window.location.origin;
    }

    /**
     * Metadata to use for dynamic OIDC client registrations
     */
    public async getOidcClientMetadata(): Promise<OidcRegistrationClientMetadata> {
        const config = SdkConfig.get();
        return {
            clientName: config.brand,
            clientUri: config.oidc_metadata?.client_uri ?? this.defaultOidcClientUri,
            redirectUris: [this.getOidcCallbackUrl().href],
            logoUri: config.oidc_metadata?.logo_uri ?? new URL("vector-icons/1024.png", this.baseUrl).href,
            applicationType: "web",
            contacts: config.oidc_metadata?.contacts,
            tosUri: config.oidc_metadata?.tos_uri ?? config.terms_and_conditions_links?.[0]?.url,
            policyUri: config.oidc_metadata?.policy_uri ?? config.privacy_policy_url,
        };
    }

    /**
     * Suffix to append to the `state` parameter of OIDC /auth calls. Will be round-tripped to the callback URI.
     * Currently only required for ElectronPlatform for passing element-desktop-ssoid.
     */
    public getOidcClientState(): string {
        return "";
    }

    /**
     * The URL to return to after a successful OIDC authentication
     */
    public getOidcCallbackUrl(): URL {
        const url = new URL(window.location.href);
        // The redirect URL has to exactly match that registered at the OIDC server, so
        // ensure that the fragment part of the URL is empty.
        url.hash = "";
        return url;
    }

    /**
     * Delay creating the `Favicon` instance until first use (on the first notification) as
     * it uses canvas, which can trigger a permission prompt in Firefox's resist fingerprinting mode.
     * See https://github.com/element-hq/element-web/issues/9605.
     */
    public get favicon(): Favicon {
        if (this._favicon) {
            return this._favicon;
        }
        this._favicon = new Favicon();
        return this._favicon;
    }

    private updateFavicon(): void {
        let bgColor = "#d00";
        let notif: string | number = this.notificationCount;

        if (this.errorDidOccur) {
            notif = notif || "×";
            bgColor = "#f00";
        }

        this.favicon.badge(notif, { bgColor });
    }

    /**
     * Begin update polling, if applicable
     */
    public startUpdater(): void {}
}

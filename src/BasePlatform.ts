/*
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import {MatrixClient} from "matrix-js-sdk/src/client";
import dis from './dispatcher/dispatcher';
import BaseEventIndexManager from './indexing/BaseEventIndexManager';
import {ActionPayload} from "./dispatcher/payloads";
import {CheckUpdatesPayload} from "./dispatcher/payloads/CheckUpdatesPayload";
import {Action} from "./dispatcher/actions";
import {hideToast as hideUpdateToast} from "./toasts/UpdateToast";

export const HOMESERVER_URL_KEY = "mx_hs_url";
export const ID_SERVER_URL_KEY = "mx_is_url";

export enum UpdateCheckStatus {
    Checking = "CHECKING",
    Error = "ERROR",
    NotAvailable = "NOTAVAILABLE",
    Downloading = "DOWNLOADING",
    Ready = "READY",
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

    constructor() {
        dis.register(this.onAction);
        this.startUpdateCheck = this.startUpdateCheck.bind(this);
    }

    protected onAction = (payload: ActionPayload) => {
        switch (payload.action) {
            case 'on_client_not_viable':
            case 'on_logged_out':
                this.setNotificationCount(0);
                break;
        }
    };

    // Used primarily for Analytics
    abstract getHumanReadableName(): string;

    setNotificationCount(count: number) {
        this.notificationCount = count;
    }

    setErrorStatus(errorDidOccur: boolean) {
        this.errorDidOccur = errorDidOccur;
    }

    /**
     * Whether we can call checkForUpdate on this platform build
     */
    async canSelfUpdate(): Promise<boolean> {
        return false;
    }

    startUpdateCheck() {
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
    installUpdate() {
    }

    /**
     * Check if the version update has been deferred and that deferment is still in effect
     * @param newVersion the version string to check
     */
    protected shouldShowUpdate(newVersion: string): boolean {
        try {
            const [version, deferUntil] = JSON.parse(localStorage.getItem(UPDATE_DEFER_KEY));
            return newVersion !== version || Date.now() > deferUntil;
        } catch (e) {
            return true;
        }
    }

    /**
     * Ignore the pending update and don't prompt about this version
     * until the next morning (8am).
     */
    deferUpdate(newVersion: string) {
        const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
        date.setHours(8, 0, 0, 0); // set to next 8am
        localStorage.setItem(UPDATE_DEFER_KEY, JSON.stringify([newVersion, date.getTime()]));
        hideUpdateToast();
    }

    /**
     * Returns true if the platform supports displaying
     * notifications, otherwise false.
     * @returns {boolean} whether the platform supports displaying notifications
     */
    supportsNotifications(): boolean {
        return false;
    }

    /**
     * Returns true if the application currently has permission
     * to display notifications. Otherwise false.
     * @returns {boolean} whether the application has permission to display notifications
     */
    maySendNotifications(): boolean {
        return false;
    }

    /**
     * Requests permission to send notifications. Returns
     * a promise that is resolved when the user has responded
     * to the request. The promise has a single string argument
     * that is 'granted' if the user allowed the request or
     * 'denied' otherwise.
     */
    abstract requestNotificationPermission(): Promise<string>;

    abstract displayNotification(title: string, msg: string, avatarUrl: string, room: Object);

    loudNotification(ev: Event, room: Object) {
    }

    /**
     * Returns a promise that resolves to a string representing the current version of the application.
     */
    abstract getAppVersion(): Promise<string>;

    /*
     * If it's not expected that capturing the screen will work
     * with getUserMedia, return a string explaining why not.
     * Otherwise, return null.
     */
    screenCaptureErrorString(): string {
        return "Not implemented";
    }

    /**
     * Restarts the application, without neccessarily reloading
     * any application code
     */
    abstract reload();

    supportsAutoLaunch(): boolean {
        return false;
    }

    // XXX: Surely this should be a setting like any other?
    async getAutoLaunchEnabled(): Promise<boolean> {
        return false;
    }

    async setAutoLaunchEnabled(enabled: boolean): Promise<void> {
        throw new Error("Unimplemented");
    }

    supportsAutoHideMenuBar(): boolean {
        return false;
    }

    async getAutoHideMenuBarEnabled(): Promise<boolean> {
        return false;
    }

    async setAutoHideMenuBarEnabled(enabled: boolean): Promise<void> {
        throw new Error("Unimplemented");
    }

    supportsMinimizeToTray(): boolean {
        return false;
    }

    async getMinimizeToTrayEnabled(): Promise<boolean> {
        return false;
    }

    async setMinimizeToTrayEnabled(enabled: boolean): Promise<void> {
        throw new Error("Unimplemented");
    }

    /**
     * Get our platform specific EventIndexManager.
     *
     * @return {BaseEventIndexManager} The EventIndex manager for our platform,
     * can be null if the platform doesn't support event indexing.
     */
    getEventIndexingManager(): BaseEventIndexManager | null {
        return null;
    }

    setLanguage(preferredLangs: string[]) {}

    getSSOCallbackUrl(fragmentAfterLogin: string): URL {
        const url = new URL(window.location.href);
        url.hash = fragmentAfterLogin || "";
        return url;
    }

    /**
     * Begin Single Sign On flows.
     * @param {MatrixClient} mxClient the matrix client using which we should start the flow
     * @param {"sso"|"cas"} loginType the type of SSO it is, CAS/SSO.
     * @param {string} fragmentAfterLogin the hash to pass to the app during sso callback.
     */
    startSingleSignOn(mxClient: MatrixClient, loginType: "sso" | "cas", fragmentAfterLogin: string) {
        // persist hs url and is url for when the user is returned to the app with the login token
        localStorage.setItem(HOMESERVER_URL_KEY, mxClient.getHomeserverUrl());
        if (mxClient.getIdentityServerUrl()) {
            localStorage.setItem(ID_SERVER_URL_KEY, mxClient.getIdentityServerUrl());
        }
        const callbackUrl = this.getSSOCallbackUrl(fragmentAfterLogin);
        window.location.href = mxClient.getSsoLoginUrl(callbackUrl.toString(), loginType); // redirect to SSO
    }

    onKeyDown(ev: KeyboardEvent): boolean {
        return false; // no shortcuts implemented
    }

    /**
     * Get a previously stored pickle key.  The pickle key is used for
     * encrypting libolm objects.
     * @param {string} userId the user ID for the user that the pickle key is for.
     * @param {string} userId the device ID that the pickle key is for.
     * @returns {string|null} the previously stored pickle key, or null if no
     *     pickle key has been stored.
     */
    async getPickleKey(userId: string, deviceId: string): Promise<string | null> {
        return null;
    }

    /**
     * Create and store a pickle key for encrypting libolm objects.
     * @param {string} userId the user ID for the user that the pickle key is for.
     * @param {string} userId the device ID that the pickle key is for.
     * @returns {string|null} the pickle key, or null if the platform does not
     *     support storing pickle keys.
     */
    async createPickleKey(userId: string, deviceId: string): Promise<string | null> {
        return null;
    }

    /**
     * Delete a previously stored pickle key from storage.
     * @param {string} userId the user ID for the user that the pickle key is for.
     * @param {string} userId the device ID that the pickle key is for.
     */
    async destroyPickleKey(userId: string, deviceId: string): Promise<void> {
    }
}

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
    };

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

    getSSOCallbackUrl(hsUrl: string, isUrl: string, fragmentAfterLogin: string): URL {
        const url = new URL(window.location.href);
        url.hash = fragmentAfterLogin || "";
        url.searchParams.set("homeserver", hsUrl);
        url.searchParams.set("identityServer", isUrl);
        return url;
    }

    /**
     * Begin Single Sign On flows.
     * @param {MatrixClient} mxClient the matrix client using which we should start the flow
     * @param {"sso"|"cas"} loginType the type of SSO it is, CAS/SSO.
     * @param {string} fragmentAfterLogin the hash to pass to the app during sso callback.
     */
    startSingleSignOn(mxClient: MatrixClient, loginType: "sso" | "cas", fragmentAfterLogin: string) {
        const callbackUrl = this.getSSOCallbackUrl(mxClient.getHomeserverUrl(), mxClient.getIdentityServerUrl(),
            fragmentAfterLogin);
        window.location.href = mxClient.getSsoLoginUrl(callbackUrl.toString(), loginType); // redirect to SSO
    }

    onKeyDown(ev: KeyboardEvent): boolean {
        return false; // no shortcuts implemented
    }
}

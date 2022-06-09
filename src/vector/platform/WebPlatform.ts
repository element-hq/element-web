/*
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd
Copyright 2017-2020 New Vector Ltd

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

import { UpdateCheckStatus } from "matrix-react-sdk/src/BasePlatform";
import request from 'browser-request';
import dis from 'matrix-react-sdk/src/dispatcher/dispatcher';
import { _t } from 'matrix-react-sdk/src/languageHandler';
import { hideToast as hideUpdateToast, showToast as showUpdateToast } from "matrix-react-sdk/src/toasts/UpdateToast";
import { Action } from "matrix-react-sdk/src/dispatcher/actions";
import { CheckUpdatesPayload } from 'matrix-react-sdk/src/dispatcher/payloads/CheckUpdatesPayload';
import UAParser from 'ua-parser-js';
import { logger } from "matrix-js-sdk/src/logger";

import VectorBasePlatform from './VectorBasePlatform';
import { parseQs } from "../url_utils";

const POKE_RATE_MS = 10 * 60 * 1000; // 10 min

export default class WebPlatform extends VectorBasePlatform {
    constructor() {
        super();
        // Register service worker if available on this platform
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js');
        }
    }

    getHumanReadableName(): string {
        return 'Web Platform'; // no translation required: only used for analytics
    }

    /**
     * Returns true if the platform supports displaying
     * notifications, otherwise false.
     */
    supportsNotifications(): boolean {
        return Boolean(window.Notification);
    }

    /**
     * Returns true if the application currently has permission
     * to display notifications. Otherwise false.
     */
    maySendNotifications(): boolean {
        return window.Notification.permission === 'granted';
    }

    /**
     * Requests permission to send notifications. Returns
     * a promise that is resolved when the user has responded
     * to the request. The promise has a single string argument
     * that is 'granted' if the user allowed the request or
     * 'denied' otherwise.
     */
    requestNotificationPermission(): Promise<string> {
        // annoyingly, the latest spec says this returns a
        // promise, but this is only supported in Chrome 46
        // and Firefox 47, so adapt the callback API.
        return new Promise(function(resolve, reject) {
            window.Notification.requestPermission((result) => {
                resolve(result);
            });
        });
    }

    private getMostRecentVersion(): Promise<string> {
        // We add a cachebuster to the request to make sure that we know about
        // the most recent version on the origin server. That might not
        // actually be the version we'd get on a reload (particularly in the
        // presence of intermediate caching proxies), but still: we're trying
        // to tell the user that there is a new version.

        return new Promise((resolve, reject) => {
            request(
                {
                    method: "GET",
                    url: "version",
                    qs: { cachebuster: Date.now() },
                },
                (err, response, body) => {
                    if (err || response.status < 200 || response.status >= 300) {
                        if (err === null) err = { status: response.status };
                        reject(err);
                        return;
                    }

                    resolve(this.getNormalizedAppVersion(body.trim()));
                },
            );
        });
    }

    getNormalizedAppVersion(version: string): string {
        // if version looks like semver with leading v, strip it (matches scripts/normalize-version.sh)
        const semVerRegex = /^v\d+.\d+.\d+(-.+)?$/;
        if (semVerRegex.test(version)) {
            return version.substring(1);
        }
        return version;
    }

    getAppVersion(): Promise<string> {
        return Promise.resolve(this.getNormalizedAppVersion(process.env.VERSION));
    }

    startUpdater() {
        // Poll for an update immediately, and reload the page now if we're out of date
        // already as we've just initialised an old version of the app somehow.
        //
        // Forcibly reloading the page aims to avoid users interacting at all with the old
        // and potentially broken version of the app.
        //
        // Ideally, loading an old copy would be impossible with the
        // cache-control: nocache HTTP header set, but Firefox doesn't always obey it :/
        console.log("startUpdater, current version is " + this.getNormalizedAppVersion(process.env.VERSION));
        this.pollForUpdate((version: string, newVersion: string) => {
            const query = parseQs(location);
            if (query.updated) {
                console.log("Update reloaded but still on an old version, stopping");
                // We just reloaded already and are still on the old version!
                // Show the toast rather than reload in a loop.
                showUpdateToast(version, newVersion);
                return;
            }

            // Set updated as a cachebusting query param and reload the page.
            const url = new URL(window.location.href);
            url.searchParams.set("updated", newVersion);
            console.log("Update reloading to " + url.toString());
            window.location.href = url.toString();
        });
        setInterval(() => this.pollForUpdate(showUpdateToast, hideUpdateToast), POKE_RATE_MS);
    }

    async canSelfUpdate(): Promise<boolean> {
        return true;
    }

    pollForUpdate = (
        showUpdate: (currentVersion: string, mostRecentVersion: string) => void,
        showNoUpdate?: () => void,
    ) => {
        return this.getMostRecentVersion().then((mostRecentVersion) => {
            const currentVersion = this.getNormalizedAppVersion(process.env.VERSION);

            if (currentVersion !== mostRecentVersion) {
                if (this.shouldShowUpdate(mostRecentVersion)) {
                    console.log("Update available to " + mostRecentVersion + ", will notify user");
                    showUpdate(currentVersion, mostRecentVersion);
                } else {
                    console.log("Update available to " + mostRecentVersion + " but won't be shown");
                }
                return { status: UpdateCheckStatus.Ready };
            } else {
                console.log("No update available, already on " + mostRecentVersion);
                showNoUpdate?.();
            }

            return { status: UpdateCheckStatus.NotAvailable };
        }, (err) => {
            logger.error("Failed to poll for update", err);
            return {
                status: UpdateCheckStatus.Error,
                detail: err.message || err.status ? err.status.toString() : 'Unknown Error',
            };
        });
    };

    startUpdateCheck() {
        super.startUpdateCheck();
        this.pollForUpdate(showUpdateToast, hideUpdateToast).then((updateState) => {
            dis.dispatch<CheckUpdatesPayload>({
                action: Action.CheckUpdates,
                ...updateState,
            });
        });
    }

    installUpdate() {
        window.location.reload();
    }

    getDefaultDeviceDisplayName(): string {
        // strip query-string and fragment from uri
        const url = new URL(window.location.href);

        // `appName` in the format `develop.element.io/abc/xyz`
        const appName = [
            url.host,
            url.pathname.replace(/\/$/, ""), // Remove trailing slash if present
        ].join("");

        const ua = new UAParser();
        const browserName = ua.getBrowser().name || "unknown browser";
        let osName = ua.getOS().name || "unknown OS";
        // Stylise the value from the parser to match Apple's current branding.
        if (osName === "Mac OS") osName = "macOS";
        return _t('%(appName)s (%(browserName)s, %(osName)s)', {
            appName,
            browserName,
            osName,
        });
    }

    screenCaptureErrorString(): string | null {
        // it won't work at all if you're not on HTTPS so whine whine whine
        if (window.location.protocol !== "https:") {
            return _t("You need to be using HTTPS to place a screen-sharing call.");
        }
        return null;
    }

    reload() {
        window.location.reload();
    }
}

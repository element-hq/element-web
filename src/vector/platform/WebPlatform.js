// @flow

/*
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd

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

import VectorBasePlatform, {updateStateEnum} from './VectorBasePlatform';
import request from 'browser-request';
import dis from 'matrix-react-sdk/lib/dispatcher.js';
import { _t } from 'matrix-react-sdk/lib/languageHandler';
import q from 'q';

import url from 'url';
import UAParser from 'ua-parser-js';

var POKE_RATE_MS = 10 * 60 * 1000; // 10 min

export default class WebPlatform extends VectorBasePlatform {
    constructor() {
        super();
        this.runningVersion = null;
    }

    getHumanReadableName(): string {
        return 'Web Platform'; // no translation required: only used for analytics
    }

    /**
     * Returns true if the platform supports displaying
     * notifications, otherwise false.
     */
    supportsNotifications(): boolean {
        return Boolean(global.Notification);
    }

    /**
     * Returns true if the application currently has permission
     * to display notifications. Otherwise false.
     */
    maySendNotifications(): boolean {
        return global.Notification.permission === 'granted';
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
        const defer = q.defer();
        global.Notification.requestPermission((result) => {
            defer.resolve(result);
        });
        return defer.promise;
    }

    displayNotification(title: string, msg: string, avatarUrl: string, room: Object) {
        const notification = new global.Notification(
            title,
            {
                body: msg,
                icon: avatarUrl,
                tag: "vector",
                silent: true, // we play our own sounds
            },
        );

        notification.onclick = function() {
            dis.dispatch({
                action: 'view_room',
                room_id: room.roomId,
            });
            global.focus();
            notification.close();
        };

        // Chrome only dismisses notifications after 20s, which
        // is waaaaay too long
        global.setTimeout(function() {
            notification.close();
        }, 5 * 1000);
    }

    _getVersion(): Promise<string> {
        const deferred = q.defer();

        // We add a cachebuster to the request to make sure that we know about
        // the most recent version on the origin server. That might not
        // actually be the version we'd get on a reload (particularly in the
        // presence of intermediate caching proxies), but still: we're trying
        // to tell the user that there is a new version.
        request(
            {
                method: "GET",
                url: "version",
                qs: { cachebuster: Date.now() },
            },
            (err, response, body) => {
                if (err || response.status < 200 || response.status >= 300) {
                    if (err === null) err = { status: response.status };
                    deferred.reject(err);
                    return;
                }

                const ver = body.trim();
                deferred.resolve(ver);
            },
        );
        return deferred.promise;
    }

    getAppVersion(): Promise<string> {
        if (this.runningVersion !== null) {
            return q(this.runningVersion);
        }
        return this._getVersion();
    }

    startUpdater() {
        this.checkForUpdate();
        setInterval(this.checkForUpdate, POKE_RATE_MS);
    }

    checkForUpdate() {
        return this._getVersion().then((ver) => {
            if (this.runningVersion === null) {
                this.runningVersion = ver;
            } else if (this.runningVersion !== ver) {
                dis.dispatch({
                    action: 'new_version',
                    currentVersion: this.runningVersion,
                    newVersion: ver,
                });
                return updateStateEnum.READY;
            }
            return updateStateEnum.NOTAVAILABLE;
        }, (err) => {
            console.error("Failed to poll for update", err);
            return updateStateEnum.ERROR;
        });
    }

    installUpdate() {
        window.location.reload();
    }

    getDefaultDeviceDisplayName(): string {
        // strip query-string and fragment from uri
        const u = url.parse(window.location.href);
        u.search = "";
        u.hash = "";
        const appName = u.format();

        const ua = new UAParser();
        const browserName = ua.getBrowser().name;
        const osName = ua.getOS().name;
        return _t('%(appName)s via %(browserName)s on %(osName)s', {appName: appName, browserName: browserName, osName: osName});
    }

    screenCaptureErrorString(): ?string {
        // it won't work at all if you're not on HTTPS so whine whine whine
        if (!global.window || global.window.location.protocol !== "https:") {
            return _t("You need to be using HTTPS to place a screen-sharing call.");
        }
        return null;
    }

    reload() {
        // forceReload=false since we don't really need new HTML/JS files
        // we just need to restart the JS runtime.
        window.location.reload(false);
    }
}

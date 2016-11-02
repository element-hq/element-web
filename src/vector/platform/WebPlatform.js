// @flow

/*
Copyright 2016 Aviral Dasgupta and OpenMarket Ltd

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

import VectorBasePlatform from './VectorBasePlatform';
import Favico from 'favico.js';
import request from 'browser-request';
import dis from 'matrix-react-sdk/lib/dispatcher.js';
import q from 'q';

export default class WebPlatform extends VectorBasePlatform {
    constructor() {
        super();
        this.runningVersion = null;
        // The 'animations' are really low framerate and look terrible.
        // Also it re-starts the animationb every time you set the badge,
        // and we set the state each time, even if the value hasn't changed,
        // so we'd need to fix that if enabling the animation.
        this.favicon = new Favico({animation: 'none'});
        this._updateFavicon();
    }

    _updateFavicon() {
        try {
            // This needs to be in in a try block as it will throw
            // if there are more than 100 badge count changes in
            // its internal queue
            let bgColor = "#d00",
                notif = this.notificationCount;

            if (this.errorDidOccur) {
                notif = notif || "×";
                bgColor = "#f00";
            }

            this.favicon.badge(notif, {
                bgColor: bgColor
            });
        } catch (e) {
            console.warn(`Failed to set badge count: ${e.message}`);
        }
    }

    setNotificationCount(count: number) {
        super.setNotificationCount(count);
        this._updateFavicon();
    }

    setErrorStatus(errorDidOccur: boolean) {
        super.setErrorStatus(errorDidOccur);
        this._updateFavicon();
    }

    displayNotification(title: string, msg: string, avatarUrl: string) {
        const notification = new global.Notification(
            title,
            {
                body: msg,
                icon: avatarUrl,
                tag: "vector",
                silent: true, // we play our own sounds
            }
        );

        notification.onclick = function() {
            dis.dispatch({
                action: 'view_room',
                room_id: room.roomId
            });
            global.focus();
        };

        // Chrome only dismisses notifications after 20s, which
        // is waaaaay too long
        global.setTimeout(function() {
            notification.close();
        }, 5 * 1000);
    }

    _getVersion() {
        const deferred = q.defer();
        request(
            { method: "GET", url: "version" },
            (err, response, body) => {
                if (err || response.status < 200 || response.status >= 300) {
                    if (err == null) err = { status: response.status };
                    deferred.reject(err);
                    return;
                }

                const ver = body.trim();
                deferred.resolve(ver);
            }
        );
        return deferred.promise;
    }

    pollForUpdate() {
        this._getVersion().done((ver) => {
            if (this.runningVersion == null) {
                this.runningVersion = ver;
            } else if (this.runningVersion != ver) {
                dis.dispatch({
                    action: 'new_version',
                    currentVersion: this.runningVersion,
                    newVersion: ver,
                });
            }
        }, (err) => {
            console.error("Failed to poll for update", err);
        });
    }

    installUpdate() {
        window.location.reload();
    }
}

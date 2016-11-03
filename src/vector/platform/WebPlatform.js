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

import BasePlatform from 'matrix-react-sdk/lib/BasePlatform';
import Favico from 'favico.js';
import dis from 'matrix-react-sdk/lib/dispatcher.js';
import q from 'q';

export default class WebPlatform extends BasePlatform {
    constructor() {
        super();
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

    /**
     * Returns true if the platform supports displaying
     * notifications, otherwise false.
     */
    supportsNotifications() : boolean {
        return Boolean(global.Notification);
    }

    /**
     * Returns true if the application currently has permission
     * to display notifications. Otherwise false.
     */
    maySendNotifications() : boolean {
        return global.Notification.permission == 'granted';
    }

    /**
     * Requests permission to send notifications. Returns
     * a promise that is resolved when the user has responded
     * to the request. The promise has a single string argument
     * that is 'granted' if the user allowed the request or
     * 'denied' otherwise.
     */
    requestNotificationPermission() : Promise {
        // annoyingly, the latest spec says this returns a
        // promise, but this is only supported in Chrome 46
        // and Firefox 47, so adapt the callback API.
        const defer = q.defer();
        global.Notification.requestPermission((result) => {
            defer.resolve(result);
        });
        return defer.promise;
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
}

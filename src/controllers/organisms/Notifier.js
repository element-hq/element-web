/*
Copyright 2015 OpenMarket Ltd

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

'use strict';

var MatrixClientPeg = require("../../MatrixClientPeg");
var dis = require("../../dispatcher");

/*
 * Dispatches:
 * {
 *   action: "notifier_enabled",
 *   value: boolean
 * }
 */

module.exports = {
    start: function() {
        this.boundOnRoomTimeline = this.onRoomTimeline.bind(this);
        MatrixClientPeg.get().on('Room.timeline', this.boundOnRoomTimeline);
    },

    stop: function() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener('Room.timeline', this.boundOnRoomTimeline);
        }
    },

    supportsDesktopNotifications: function() {
        return !!global.Notification;
    },

    havePermission: function() {
        return global.Notification.permission == 'granted';
    },

    setEnabled: function(enable, callback) {
        console.log("Notifier.setEnabled => %s", enable);
        if(enable) {
            if (!this.havePermission()) {
                var self = this;
                global.Notification.requestPermission(function() {
                    if (callback) {
                        callback();
                        dis.dispatch({
                            action: "notifier_enabled",
                            value: true
                        });
                    }
                });
            }

            if (!global.localStorage) return;
            global.localStorage.setItem('notifications_enabled', 'true');

            if (this.havePermission) {
                dis.dispatch({
                    action: "notifier_enabled",
                    value: true
                });
            }
        }
        else {
            if (!global.localStorage) return;
            global.localStorage.setItem('notifications_enabled', 'false');
            dis.dispatch({
                action: "notifier_enabled",
                value: false
            });
        }
    },

    isEnabled: function() {
        if (!this.havePermission()) return false;

        if (!global.localStorage) return true;

        var enabled = global.localStorage.getItem('notifications_enabled');
        if (enabled === null) return true;
        return enabled === 'true';
    },

    onRoomTimeline: function(ev, room, toStartOfTimeline) {
        if (toStartOfTimeline) return;
        if (ev.sender && ev.sender.userId == MatrixClientPeg.get().credentials.userId) return;

        if (!this.isEnabled()) {
            return;
        }

        var actions = MatrixClientPeg.get().getPushActionsForEvent(ev);
        if (actions && actions.notify) {
            this.displayNotification(ev, room);
        }
    }
};


/*
Copyright 2015, 2016 OpenMarket Ltd

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

var MatrixClientPeg = require("./MatrixClientPeg");
var TextForEvent = require('./TextForEvent');
var Avatar = require('./Avatar');
var dis = require("./dispatcher");

/*
 * Dispatches:
 * {
 *   action: "notifier_enabled",
 *   value: boolean
 * }
 */

var Notifier = {

    notificationMessageForEvent: function(ev) {
        return TextForEvent.textForEvent(ev);
    },

    displayNotification: function(ev, room) {
        if (!global.Notification || global.Notification.permission != 'granted') {
            return;
        }
        if (global.document.hasFocus()) {
            return;
        }

        var msg = this.notificationMessageForEvent(ev);
        if (!msg) return;

        var title;
        if (!ev.sender ||  room.name == ev.sender.name) {
            title = room.name;
            // notificationMessageForEvent includes sender,
            // but we already have the sender here
            if (ev.getContent().body) msg = ev.getContent().body;
        } else if (ev.getType() == 'm.room.member') {
            // context is all in the message here, we don't need
            // to display sender info
            title = room.name;
        } else if (ev.sender) {
            title = ev.sender.name + " (" + room.name + ")";
            // notificationMessageForEvent includes sender,
            // but we've just out sender in the title
            if (ev.getContent().body) msg = ev.getContent().body;
        }

        var avatarUrl = ev.sender ? Avatar.avatarUrlForMember(
            ev.sender, 40, 40, 'crop'
        ) : null;

        var notification = new global.Notification(
            title,
            {
                "body": msg,
                "icon": avatarUrl,
                "tag": "matrixreactsdk"
            }
        );

        notification.onclick = function() {
            dis.dispatch({
                action: 'view_room',
                room_id: room.roomId
            });
            global.focus();
        };
        
        /*var audioClip;
        
        if (audioNotification) {
            audioClip = playAudio(audioNotification);
        }*/

        global.setTimeout(function() {
            notification.close();
        }, 5 * 1000);
        
    },

    start: function() {
        this.boundOnRoomTimeline = this.onRoomTimeline.bind(this);
        this.boundOnSyncStateChange = this.onSyncStateChange.bind(this);
        MatrixClientPeg.get().on('Room.timeline', this.boundOnRoomTimeline);
        MatrixClientPeg.get().on("sync", this.boundOnSyncStateChange);
        this.toolbarHidden = false;
    },

    stop: function() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener('Room.timeline', this.boundOnRoomTimeline);
            MatrixClientPeg.get().removeListener('sync', this.boundOnSyncStateChange);
        }
    },

    supportsDesktopNotifications: function() {
        return !!global.Notification;
    },

    havePermission: function() {
        if (!this.supportsDesktopNotifications()) return false;
        return global.Notification.permission == 'granted';
    },

    setEnabled: function(enable, callback) {
        if(enable) {
            if (!this.havePermission()) {
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

        this.setToolbarHidden(false);
    },

    isEnabled: function() {
        if (!this.havePermission()) return false;

        if (!global.localStorage) return true;

        var enabled = global.localStorage.getItem('notifications_enabled');
        if (enabled === null) return true;
        return enabled === 'true';
    },

    setToolbarHidden: function(hidden) {
        this.toolbarHidden = hidden;
        dis.dispatch({
            action: "notifier_enabled",
            value: this.isEnabled()
        });
    },

    isToolbarHidden: function() {
        return this.toolbarHidden;
    },

    onSyncStateChange: function(state) {
        if (state === "PREPARED" || state === "SYNCING") {
            this.isPrepared = true;
        }
    },

    onRoomTimeline: function(ev, room, toStartOfTimeline) {
        if (toStartOfTimeline) return;
        if (!this.isPrepared) return; // don't alert for any messages initially
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

if (!global.mxNotifier) {
    global.mxNotifier = Notifier;
}

module.exports = global.mxNotifier;
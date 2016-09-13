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

    _displayPopupNotification: function(ev, room) {
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

        global.setTimeout(function() {
            notification.close();
        }, 5 * 1000);
    },

    _playAudioNotification: function(ev, room) {
        var e = document.getElementById("messageAudio");
        if (e) {
            e.load();
            e.play();
        };
    },

    start: function() {
        this.boundOnRoomTimeline = this.onRoomTimeline.bind(this);
        this.boundOnSyncStateChange = this.onSyncStateChange.bind(this);
        MatrixClientPeg.get().on('Room.timeline', this.boundOnRoomTimeline);
        MatrixClientPeg.get().on("sync", this.boundOnSyncStateChange);
        this.toolbarHidden = false;
        this.isPrepared = false;
    },

    stop: function() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener('Room.timeline', this.boundOnRoomTimeline);
            MatrixClientPeg.get().removeListener('sync', this.boundOnSyncStateChange);
        }
        this.isPrepared = false;
    },

    supportsDesktopNotifications: function() {
        return !!global.Notification;
    },

    havePermission: function() {
        if (!this.supportsDesktopNotifications()) return false;
        return global.Notification.permission == 'granted';
    },

    setEnabled: function(enable, callback) {
        // make sure that we persist the current setting audio_enabled setting
        // before changing anything
        if (global.localStorage) {
            if(global.localStorage.getItem('audio_notifications_enabled') == null) {
                this.setAudioEnabled(this.isEnabled());
            }
        }

        if (enable) {
            // Attempt to get permission from user
            global.Notification.requestPermission(function(result) {
                if (result !== 'granted') {
                    // The permission request was dismissed or denied
                    return;
                }

                if (global.localStorage) {
                    global.localStorage.setItem('notifications_enabled', 'true');
                }

                if (callback) callback();
                dis.dispatch({
                    action: "notifier_enabled",
                    value: true
                });
            });
            // clear the notifications_hidden flag, so that if notifications are
            // disabled again in the future, we will show the banner again.
            this.setToolbarHidden(false);
        } else {
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

    setAudioEnabled: function(enable) {
        if (!global.localStorage) return;
        global.localStorage.setItem('audio_notifications_enabled',
                                    enable ? 'true' : 'false');
    },

    isAudioEnabled: function(enable) {
        if (!global.localStorage) return true;
        var enabled = global.localStorage.getItem(
            'audio_notifications_enabled');
        // default to true if the popups are enabled
        if (enabled === null) return this.isEnabled();
        return enabled === 'true';
    },

    setToolbarHidden: function(hidden, persistent = true) {
        this.toolbarHidden = hidden;

        // XXX: why are we dispatching this here?
        // this is nothing to do with notifier_enabled
        dis.dispatch({
            action: "notifier_enabled",
            value: this.isEnabled()
        });

        // update the info to localStorage for persistent settings
        if (persistent && global.localStorage) {
            global.localStorage.setItem('notifications_hidden', hidden);
        }
    },

    isToolbarHidden: function() {
        // Check localStorage for any such meta data
        if (global.localStorage) {
            if (global.localStorage.getItem('notifications_hidden') === 'true') {
                return true;
            }
        }

        return this.toolbarHidden;
    },

    onSyncStateChange: function(state) {
        if (state === "PREPARED" || state === "SYNCING") {
            this.isPrepared = true;
        }
        else if (state === "STOPPED" || state === "ERROR") {
            this.isPrepared = false;
        }
    },

    onRoomTimeline: function(ev, room, toStartOfTimeline, removed, data) {
        if (toStartOfTimeline) return;
        if (!room) return;
        if (!this.isPrepared) return; // don't alert for any messages initially
        if (ev.sender && ev.sender.userId == MatrixClientPeg.get().credentials.userId) return;
        if (data.timeline.getTimelineSet() !== room.getUnfilteredTimelineSet()) return;

        var actions = MatrixClientPeg.get().getPushActionsForEvent(ev);
        if (actions && actions.notify) {
            if (this.isEnabled()) {
                this._displayPopupNotification(ev, room);
            }
            if (actions.tweaks.sound && this.isAudioEnabled()) {
                this._playAudioNotification(ev, room);
            }
        }
    }
};

if (!global.mxNotifier) {
    global.mxNotifier = Notifier;
}

module.exports = global.mxNotifier;

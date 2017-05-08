/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd

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

import MatrixClientPeg from './MatrixClientPeg';
import PlatformPeg from './PlatformPeg';
import TextForEvent from './TextForEvent';
import Avatar from './Avatar';
import dis from './dispatcher';
import sdk from './index';
import Modal from './Modal';

/*
 * Dispatches:
 * {
 *   action: "notifier_enabled",
 *   value: boolean
 * }
 */

const Notifier = {
    notifsByRoom: {},

    notificationMessageForEvent: function(ev) {
        return TextForEvent.textForEvent(ev);
    },

    _displayPopupNotification: function(ev, room) {
        const plaf = PlatformPeg.get();
        if (!plaf) {
            return;
        }
        if (!plaf.supportsNotifications() || !plaf.maySendNotifications()) {
            return;
        }
        if (global.document.hasFocus()) {
            return;
        }

        let msg = this.notificationMessageForEvent(ev);
        if (!msg) return;

        let title;
        if (!ev.sender || room.name === ev.sender.name) {
            title = room.name;
            // notificationMessageForEvent includes sender,
            // but we already have the sender here
            if (ev.getContent().body) msg = ev.getContent().body;
        } else if (ev.getType() === 'm.room.member') {
            // context is all in the message here, we don't need
            // to display sender info
            title = room.name;
        } else if (ev.sender) {
            title = ev.sender.name + " (" + room.name + ")";
            // notificationMessageForEvent includes sender,
            // but we've just out sender in the title
            if (ev.getContent().body) msg = ev.getContent().body;
        }

        const avatarUrl = ev.sender ? Avatar.avatarUrlForMember(
            ev.sender, 40, 40, 'crop'
        ) : null;

        const notif = plaf.displayNotification(title, msg, avatarUrl, room);

        // if displayNotification returns non-null,  the platform supports
        // clearing notifications later, so keep track of this.
        if (notif) {
            if (this.notifsByRoom[ev.getRoomId()] === undefined) this.notifsByRoom[ev.getRoomId()] = [];
            this.notifsByRoom[ev.getRoomId()].push(notif);
        }
    },

    _playAudioNotification: function(ev, room) {
        const e = document.getElementById("messageAudio");
        if (e) {
            e.load();
            e.play();
        }
    },

    start: function() {
        this.boundOnRoomTimeline = this.onRoomTimeline.bind(this);
        this.boundOnSyncStateChange = this.onSyncStateChange.bind(this);
        this.boundOnRoomReceipt = this.onRoomReceipt.bind(this);
        MatrixClientPeg.get().on('Room.timeline', this.boundOnRoomTimeline);
        MatrixClientPeg.get().on('Room.receipt', this.boundOnRoomReceipt);
        MatrixClientPeg.get().on("sync", this.boundOnSyncStateChange);
        this.toolbarHidden = false;
        this.isSyncing = false;
    },

    stop: function() {
        if (MatrixClientPeg.get() && this.boundOnRoomTimeline) {
            MatrixClientPeg.get().removeListener('Room.timeline', this.boundOnRoomTimeline);
            MatrixClientPeg.get().removeListener('Room.receipt', this.boundOnRoomReceipt);
            MatrixClientPeg.get().removeListener('sync', this.boundOnSyncStateChange);
        }
        this.isSyncing = false;
    },

    supportsDesktopNotifications: function() {
        const plaf = PlatformPeg.get();
        return plaf && plaf.supportsNotifications();
    },

    setEnabled: function(enable, callback) {
        const plaf = PlatformPeg.get();
        if (!plaf) return;
        // make sure that we persist the current setting audio_enabled setting
        // before changing anything
        if (global.localStorage) {
            if (global.localStorage.getItem('audio_notifications_enabled') === null) {
                this.setAudioEnabled(this.isEnabled());
            }
        }

        if (enable) {
            // Attempt to get permission from user
            plaf.requestNotificationPermission().done((result) => {
                if (result !== 'granted') {
                    // The permission request was dismissed or denied
                    const description = result === 'denied'
                        ? 'Riot does not have permission to send you notifications'
                        + ' - please check your browser settings'
                        : 'Riot was not given permission to send notifications'
                        + ' - please try again';
                    const ErrorDialog = sdk.getComponent('dialogs.ErrorDialog');
                    Modal.createDialog(ErrorDialog, {
                        title: 'Unable to enable Notifications',
                        description,
                    });
                    return;
                }

                if (global.localStorage) {
                    global.localStorage.setItem('notifications_enabled', 'true');
                }

                if (callback) callback();
                dis.dispatch({
                    action: "notifier_enabled",
                    value: true,
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
                value: false,
            });
        }
    },

    isEnabled: function() {
        const plaf = PlatformPeg.get();
        if (!plaf) return false;
        if (!plaf.supportsNotifications()) return false;
        if (!plaf.maySendNotifications()) return false;

        if (!global.localStorage) return true;

        const enabled = global.localStorage.getItem('notifications_enabled');
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
        const enabled = global.localStorage.getItem(
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
            value: this.isEnabled(),
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
        if (state === "SYNCING") {
            this.isSyncing = true;
        } else if (state === "STOPPED" || state === "ERROR") {
            this.isSyncing = false;
        }
    },

    onRoomTimeline: function(ev, room, toStartOfTimeline, removed, data) {
        if (toStartOfTimeline) return;
        if (!room) return;
        if (!this.isSyncing) return; // don't alert for any messages initially
        if (ev.sender && ev.sender.userId === MatrixClientPeg.get().credentials.userId) return;
        if (data.timeline.getTimelineSet() !== room.getUnfilteredTimelineSet()) return;

        const actions = MatrixClientPeg.get().getPushActionsForEvent(ev);
        if (actions && actions.notify) {
            if (this.isEnabled()) {
                this._displayPopupNotification(ev, room);
            }
            if (actions.tweaks.sound && this.isAudioEnabled()) {
                this._playAudioNotification(ev, room);
            }
        }
    },

    onRoomReceipt: function(ev, room) {
        if (room.getUnreadNotificationCount() === 0) {
            // ideally we would clear each notification when it was read,
            // but we have no way, given a read receipt, to know whether
            // the receipt comes before or after an event, so we can't
            // do this. Instead, clear all notifications for a room once
            // there are no notifs left in that room., which is not quite
            // as good but it's something.
            const plaf = PlatformPeg.get();
            if (!plaf) return;
            if (this.notifsByRoom[room.roomId] === undefined) return;
            for (const notif of this.notifsByRoom[room.roomId]) {
                plaf.clearNotification(notif);
            }
            delete this.notifsByRoom[room.roomId];
        }
    },
};

if (!global.mxNotifier) {
    global.mxNotifier = Notifier;
}

module.exports = global.mxNotifier;

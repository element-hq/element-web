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

var NotifierController = require("../../../../src/controllers/organisms/Notifier");

var MatrixClientPeg = require("../../../../src/MatrixClientPeg");
var extend = require("../../../../src/extend");
var dis = require("../../../../src/dispatcher");


var NotifierView = {
    notificationMessageForEvent: function(ev) {
        var senderDisplayName = ev.sender ? ev.sender.name : '';
        var message = null;

        if (ev.event.type === "m.room.message") {
            message = ev.getContent().body;
            if (ev.getContent().msgtype === "m.emote") {
                message = "* " + senderDisplayName + " " + message;
            } else if (ev.getContent().msgtype === "m.image") {
                message = senderDisplayName + " sent an image.";
            }
        } else if (ev.event.type == "m.room.member") {
            if (ev.event.state_key !== MatrixClientPeg.get().credentials.userId  && "join" === ev.getContent().membership) {
                // Notify when another user joins
                message = senderDisplayName + " joined";
            } else if (ev.event.state_key === MatrixClientPeg.get().credentials.userId  && "invite" === ev.getContent().membership) {
                // notify when you are invited
                message = senderDisplayName + " invited you to a room";
            }
        }
        return message;
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
        } else if (ev.sender) {
            title = ev.sender.name + " (" + room.name + ")";
        }

        var notification = new global.Notification(
            title,
            {
                "body": msg,
                "icon": MatrixClientPeg.get().getAvatarUrlForMember(ev.sender)
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
        
    }
};

var NotifierClass = function() {};
extend(NotifierClass.prototype, NotifierController);
extend(NotifierClass.prototype, NotifierView);

module.exports = new NotifierClass();


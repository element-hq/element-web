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

var NotifierController = require('matrix-react-sdk/lib/controllers/organisms/Notifier')

var TextForEvent = require('matrix-react-sdk/lib/TextForEvent');
var extend = require('matrix-react-sdk/lib/extend');
var dis = require('matrix-react-sdk/lib/dispatcher');

var Avatar = require('../../../../Avatar');


var NotifierView = {
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
                "tag": "vector"
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


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

    onRoomTimeline: function(ev, room, toStartOfTimeline) {
        if (toStartOfTimeline) return;
        if (ev.sender.userId == MatrixClientPeg.get().credentials.userId) return;

        var enabled = global.localStorage.getItem('notifications_enabled');
        if (enabled === 'false') return;

        var actions = MatrixClientPeg.get().getPushActionsForEvent(ev);
        if (actions && actions.notify) {
            this.displayNotification(ev, room);
        }
    }
};


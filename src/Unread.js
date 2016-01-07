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

var MatrixClientPeg = require('./MatrixClientPeg');

module.exports = {
    /**
     * Returns true iff this event arriving in a room should affect the room's
     * count of unread messages
     */
    eventTriggersUnreadCount: function(ev) {
        if (ev.getType() == "m.room.member") {
            return false;
        } else if (ev.getType == 'm.room.message' && ev.getContent().msgtype == 'm.notify') {
            return false;
        }
        return true;
    },

    doesRoomHaveUnreadMessages: function(room) {
        var readUpToId = room.getEventReadUpTo(MatrixClientPeg.get().credentials.userId);
        // this just looks at whatever history we have, which if we've only just started
        // up probably won't be very much, so if the last couple of events are ones that
        // don't count, we don't know if there are any events that do count between where
        // we have and the read receipt. We could fetch more history to try & find out,
        // but currently we just guess. This impl assumes there are unread messages
        // on the theory that false positives are better than false negatives here.
        var unread = true;
        for (var i = room.timeline.length - 1; i >= 0; --i) {
            var ev = room.timeline[i];

            if (ev.getId() == readUpToId) {
                unread = false;
                break;
            }

            if (this.eventTriggersUnreadCount(ev)) {
                break;
            }
        }
        return unread;
    }
};

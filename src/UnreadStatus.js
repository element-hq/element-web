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
    }
};

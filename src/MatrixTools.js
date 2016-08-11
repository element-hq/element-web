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
var CallHandler = require('./CallHandler');

module.exports = {
    /**
     * Given a room object, return the alias we should use for it,
     * if any. This could be the canonical alias if one exists, otherwise
     * an alias selected arbitrarily but deterministically from the list
     * of aliases. Otherwise return null;
     */
    getDisplayAliasForRoom: function(room) {
        return room.getCanonicalAlias() || room.getAliases()[0];
    },

    isDirectMessageRoom: function(room, me, ConferenceHandler, hideConferenceChans) {
        if (me.membership == "join" || me.membership === "ban" ||
            (me.membership === "leave" && me.events.member.getSender() !== me.events.member.getStateKey()))
        {
            // Used to split rooms via tags
            var tagNames = Object.keys(room.tags);
            // Used for 1:1 direct chats
            var joinedMembers = room.getJoinedMembers();

            // Show 1:1 chats in seperate "Direct Messages" section as long as they haven't
            // been moved to a different tag section
            if (joinedMembers.length === 2 && !tagNames.length) {
                var otherMember = joinedMembers.filter(function(m) {
                    return m.userId !== me.userId
                })[0];

                if (ConferenceHandler && ConferenceHandler.isConferenceUser(otherMember.userId)) {
                    // console.log("Hiding conference 1:1 room %s", room.roomId);
                    if (!hideConferenceChans) {
                        return true;
                    }
                } else {
                    return true;
                }
            }
        }
        return false;
    },
}


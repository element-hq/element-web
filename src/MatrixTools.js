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
     * Given a room object, return the canonical alias for it
     * if there is one. Otherwise return null;
     */
    getCanonicalAliasForRoom: function(room) {
        var aliasEvents = room.currentState.getStateEvents(
            "m.room.aliases"
        );
        // Canonical aliases aren't implemented yet, so just return the first
        for (var j = 0; j < aliasEvents.length; j++) {
            var aliases = aliasEvents[j].getContent().aliases;
            if (aliases && aliases.length) {
                return aliases[0];
            }
        }
        return null;
    },

    /**
     * Given a list of room objects, return the room which has the given alias,
     * else null.
     */
    getRoomForAlias: function(rooms, room_alias) {
        var room;
        for (var i = 0; i < rooms.length; i++) {
            var aliasEvents = rooms[i].currentState.getStateEvents(
                "m.room.aliases"
            );
            for (var j = 0; j < aliasEvents.length; j++) {
                var aliases = aliasEvents[j].getContent().aliases || [];
                for (var k = 0; k < aliases.length; k++) {
                    if (aliases[k] === room_alias) {
                        room = rooms[i];
                        break;
                    }
                }
                if (room) { break; }
            }
            if (room) { break; }
        }
        return room || null;
    }
}


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

var MatrixClientPeg = require("./MatrixClientPeg");
var dis = require("./dispatcher");

var reject = function(msg) {
    return {
        error: msg
    };
};

var success = function(promise) {
    return {
        promise: promise
    };
};

var commands = {
    // Change your nickname
    nick: function(room_id, args) {
        if (args) {
            return success(
                MatrixClientPeg.get().setDisplayName(args)
            );
        }
        return reject("Usage: /nick <display_name>");
    },

    // Invite a user
    invite: function(room_id, args) {
        if (args) {
            var matches = args.match(/^(\S+)$/);
            if (matches) {
                return success(
                    MatrixClientPeg.get().invite(room_id, matches[1])
                );
            }
        }
        return reject("Usage: /invite <userId>");
    },

    // Join a room
    join: function(room_id, args) {
        if (args) {
            var matches = args.match(/^(\S+)$/);
            if (matches) {
                var room_alias = matches[1];
                // Try to find a room with this alias
                var rooms = MatrixClientPeg.get().getRooms();
                var roomId;
                for (var i = 0; i < rooms.length; i++) {
                    var aliasEvents = rooms[i].currentState.getStateEvents(
                        "m.room.aliases"
                    );
                    for (var j = 0; j < aliasEvents.length; j++) {
                        var aliases = aliasEvents[j].getContent().aliases || [];
                        for (var k = 0; k < aliases.length; k++) {
                            if (aliases[k] === room_alias) {
                                roomId = rooms[i].roomId;
                                break;
                            }
                        }
                        if (roomId) { break; }
                    }
                    if (roomId) { break; }
                }
                if (roomId) { // we've already joined this room, view it.
                    dis.dispatch({
                        action: 'view_room',
                        room_id: roomId
                    });
                    return success();
                }
                else {
                    // attempt to join this alias.
                    return success(
                        MatrixClientPeg.get().joinRoom(room_alias).done(
                        function(room) {
                            dis.dispatch({
                                action: 'view_room',
                                room_id: room.roomId
                            });
                        }, function(err) {
                            console.error(
                                "Failed to join room: %s", JSON.stringify(err)
                            );
                        })
                    );
                }
            }
        }
        return reject("Usage: /join <room_alias> [NOT IMPLEMENTED]");
    },

    // Kick a user from the room with an optional reason
    kick: function(room_id, args) {
        if (args) {
            var matches = args.match(/^(\S+?)( +(.*))?$/);
            if (matches) {
                return success(
                    MatrixClientPeg.get().kick(room_id, matches[1], matches[3])
                );
            }
        }
        return reject("Usage: /kick <userId> [<reason>]");
    },

    // Ban a user from the room with an optional reason
    ban: function(room_id, args) {
        if (args) {
            var matches = args.match(/^(\S+?)( +(.*))?$/);
            if (matches) {
                return success(
                    MatrixClientPeg.get().ban(room_id, matches[1], matches[3])
                );
            }
        }
        return reject("Usage: /ban <userId> [<reason>]");
    },

    // Unban a user from the room
    unban: function(room_id, args) {
        if (args) {
            var matches = args.match(/^(\S+)$/);
            if (matches) {
                // Reset the user membership to "leave" to unban him
                return success(
                    MatrixClientPeg.get().unban(room_id, matches[1])
                );
            }
        }
        return reject("Usage: /unban <userId>");
    },

    // Define the power level of a user
    op: function(room_id, args) {
        if (args) {
            var matches = args.match(/^(\S+?)( +(\d+))?$/);
            var powerLevel = 50; // default power level for op
            if (matches) {
                var user_id = matches[1];
                if (matches.length === 4 && undefined !== matches[3]) {
                    powerLevel = parseInt(matches[3]);
                }
                if (powerLevel !== NaN) {
                    var room = MatrixClientPeg.get().getRoom(room_id);
                    if (!room) {
                        return reject("Bad room ID: " + room_id);
                    }
                    var powerLevelEvent = room.currentState.getStateEvents(
                        "m.room.power_levels", ""
                    );
                    return success(
                        MatrixClientPeg.get().setPowerLevel(
                            room_id, user_id, powerLevel, powerLevelEvent
                        )
                    );
                }
            }
        }
        return reject("Usage: /op <userId> [<power level>]");
    },

    // Reset the power level of a user
    deop: function(room_id, args) {
        if (args) {
            var matches = args.match(/^(\S+)$/);
            if (matches) {
                var room = MatrixClientPeg.get().getRoom(room_id);
                if (!room) {
                    return reject("Bad room ID: " + room_id);
                }

                var powerLevelEvent = room.currentState.getStateEvents(
                    "m.room.power_levels", ""
                );
                return success(
                    MatrixClientPeg.get().setPowerLevel(
                        room_id, args, undefined, powerLevelEvent
                    )
                );
            }
        }
        return reject("Usage: /deop <userId>");
    }
};

module.exports = {
    /**
     * Process the given text for /commands and perform them.
     * @param {string} roomId The room in which the command was performed.
     * @param {string} input The raw text input by the user.
     * @return {Object|null} An object with the property 'error' if there was an error
     * processing the command, or 'promise' if a request was sent out.
     * Returns null if the input didn't match a command.
     */
    processInput: function(roomId, input) {
        // trim any trailing whitespace, as it can confuse the parser for 
        // IRC-style commands
        input = input.replace(/\s+$/, "");
        if (input[0] === "/" && input[1] !== "/") {
            var bits = input.match(/^(\S+?)( +(.*))?$/);
            var cmd = bits[1].substring(1).toLowerCase();
            var args = bits[3];
            if (commands[cmd]) {
                return commands[cmd](roomId, args);
            }
        }
        return null; // not a command
    }
};
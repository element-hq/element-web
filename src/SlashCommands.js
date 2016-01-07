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

var MatrixClientPeg = require("./MatrixClientPeg");
var MatrixTools = require("./MatrixTools");
var dis = require("./dispatcher");
var encryption = require("./encryption");
var Tinter = require("./Tinter");

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

    // Takes an #rrggbb colourcode and retints the UI (just for debugging)
    tint: function(room_id, args) {
        Tinter.tint(args);
        return success();
    },

    encrypt: function(room_id, args) {
        if (args == "on") {
            var client = MatrixClientPeg.get();
            var members = client.getRoom(room_id).currentState.members;
            var user_ids = Object.keys(members);
            return success(
                encryption.enableEncryption(client, room_id, user_ids)
            );
        }
        if (args == "off") {
            var client = MatrixClientPeg.get();
            return success(
                encryption.disableEncryption(client, room_id)
            );

        }
        return reject("Usage: encrypt <on/off>");
    },

    // Change the room topic
    topic: function(room_id, args) {
        if (args) {
            return success(
                MatrixClientPeg.get().setRoomTopic(room_id, args)
            );
        }
        return reject("Usage: /topic <topic>");
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
                if (room_alias[0] !== '#') {
                    return reject("Usage: /join #alias:domain");
                }
                if (!room_alias.match(/:/)) {
                    var domain = MatrixClientPeg.get().credentials.userId.replace(/^.*:/, '');
                    room_alias += ':' + domain;
                }

                // Try to find a room with this alias
                // XXX: do we need to do this? Doesn't the JS SDK suppress duplicate attempts to join the same room?
                var foundRoom = MatrixTools.getRoomForAlias(
                    MatrixClientPeg.get().getRooms(),
                    room_alias
                );

                if (foundRoom) { // we've already joined this room, view it if it's not archived.
                    var me = foundRoom.getMember(MatrixClientPeg.get().credentials.userId);
                    if (me && me.membership !== "leave") {
                        dis.dispatch({
                            action: 'view_room',
                            room_id: foundRoom.roomId
                        });
                        return success();                        
                    }
                }

                // otherwise attempt to join this alias.
                return success(
                    MatrixClientPeg.get().joinRoom(room_alias).then(
                    function(room) {
                        dis.dispatch({
                            action: 'view_room',
                            room_id: room.roomId
                        });
                    })
                );
            }
        }
        return reject("Usage: /join <room_alias>");
    },

    part: function(room_id, args) {
        var targetRoomId;
        if (args) {
            var matches = args.match(/^(\S+)$/);
            if (matches) {
                var room_alias = matches[1];
                if (room_alias[0] !== '#') {
                    return reject("Usage: /part [#alias:domain]");
                }
                if (!room_alias.match(/:/)) {
                    var domain = MatrixClientPeg.get().credentials.userId.replace(/^.*:/, '');
                    room_alias += ':' + domain;
                }

                // Try to find a room with this alias
                var rooms = MatrixClientPeg.get().getRooms();
                for (var i = 0; i < rooms.length; i++) {
                    var aliasEvents = rooms[i].currentState.getStateEvents(
                        "m.room.aliases"
                    );
                    for (var j = 0; j < aliasEvents.length; j++) {
                        var aliases = aliasEvents[j].getContent().aliases || [];
                        for (var k = 0; k < aliases.length; k++) {
                            if (aliases[k] === room_alias) {
                                targetRoomId = rooms[i].roomId;
                                break;
                            }
                        }
                        if (targetRoomId) { break; }
                    }
                    if (targetRoomId) { break; }
                }
            }
            if (!targetRoomId) {
                return reject("Unrecognised room alias: " + room_alias);
            }
        }
        if (!targetRoomId) targetRoomId = room_id;
        return success(
            MatrixClientPeg.get().leave(targetRoomId).then(
            function() {
                dis.dispatch({action: 'view_next_room'});
            })
        );
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

// helpful aliases
commands.j = commands.join;

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
            if (cmd === "me") return null;
            if (commands[cmd]) {
                return commands[cmd](roomId, args);
            }
            else {
                return reject("Unrecognised command: " + input);
            }
        }
        return null; // not a command
    }
};

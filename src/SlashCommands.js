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

import MatrixClientPeg from "./MatrixClientPeg";
import dis from "./dispatcher";
import Tinter from "./Tinter";
import sdk from './index';
import { _t } from './languageHandler';
import Modal from './Modal';


class Command {
    constructor(name, paramArgs, runFn) {
        this.name = name;
        this.paramArgs = paramArgs;
        this.runFn = runFn;
    }

    getCommand() {
        return "/" + this.name;
    }

    getCommandWithArgs() {
        return this.getCommand() + " " + this.paramArgs;
    }

    run(roomId, args) {
        return this.runFn.bind(this)(roomId, args);
    }

    getUsage() {
        return _t('Usage') + ': ' + this.getCommandWithArgs();
    }
}

function reject(msg) {
    return {
        error: msg,
    };
}

function success(promise) {
    return {
        promise: promise,
    };
}

/* Disable the "unexpected this" error for these commands - all of the run
 * functions are called with `this` bound to the Command instance.
 */

/* eslint-disable babel/no-invalid-this */

const commands = {
    ddg: new Command("ddg", "<query>", function(roomId, args) {
        const ErrorDialog = sdk.getComponent('dialogs.ErrorDialog');
        // TODO Don't explain this away, actually show a search UI here.
        Modal.createDialog(ErrorDialog, {
            title: _t('/ddg is not a command'),
            description: _t('To use it, just wait for autocomplete results to load and tab through them.'),
        });
        return success();
    }),

    // Change your nickname
    nick: new Command("nick", "<display_name>", function(roomId, args) {
        if (args) {
            return success(
                MatrixClientPeg.get().setDisplayName(args),
            );
        }
        return reject(this.getUsage());
    }),

    // Changes the colorscheme of your current room
    tint: new Command("tint", "<color1> [<color2>]", function(roomId, args) {
        if (args) {
            const matches = args.match(/^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}))( +(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})))?$/);
            if (matches) {
                Tinter.tint(matches[1], matches[4]);
                const colorScheme = {};
                colorScheme.primary_color = matches[1];
                if (matches[4]) {
                    colorScheme.secondary_color = matches[4];
                }
                return success(
                    MatrixClientPeg.get().setRoomAccountData(
                        roomId, "org.matrix.room.color_scheme", colorScheme,
                    ),
                );
            }
        }
        return reject(this.getUsage());
    }),

    // Change the room topic
    topic: new Command("topic", "<topic>", function(roomId, args) {
        if (args) {
            return success(
                MatrixClientPeg.get().setRoomTopic(roomId, args),
            );
        }
        return reject(this.getUsage());
    }),

    // Invite a user
    invite: new Command("invite", "<userId>", function(roomId, args) {
        if (args) {
            const matches = args.match(/^(\S+)$/);
            if (matches) {
                return success(
                    MatrixClientPeg.get().invite(roomId, matches[1]),
                );
            }
        }
        return reject(this.getUsage());
    }),

    // Join a room
    join: new Command("join", "#alias:domain", function(roomId, args) {
        if (args) {
            const matches = args.match(/^(\S+)$/);
            if (matches) {
                let roomAlias = matches[1];
                if (roomAlias[0] !== '#') {
                    return reject(this.getUsage());
                }
                if (!roomAlias.match(/:/)) {
                    roomAlias += ':' + MatrixClientPeg.get().getDomain();
                }

                dis.dispatch({
                    action: 'view_room',
                    room_alias: roomAlias,
                    auto_join: true,
                });

                return success();
            }
        }
        return reject(this.getUsage());
    }),

    part: new Command("part", "[#alias:domain]", function(roomId, args) {
        let targetRoomId;
        if (args) {
            const matches = args.match(/^(\S+)$/);
            if (matches) {
                let roomAlias = matches[1];
                if (roomAlias[0] !== '#') {
                    return reject(this.getUsage());
                }
                if (!roomAlias.match(/:/)) {
                    roomAlias += ':' + MatrixClientPeg.get().getDomain();
                }

                // Try to find a room with this alias
                const rooms = MatrixClientPeg.get().getRooms();
                for (let i = 0; i < rooms.length; i++) {
                    const aliasEvents = rooms[i].currentState.getStateEvents(
                        "m.room.aliases",
                    );
                    for (let j = 0; j < aliasEvents.length; j++) {
                        const aliases = aliasEvents[j].getContent().aliases || [];
                        for (let k = 0; k < aliases.length; k++) {
                            if (aliases[k] === roomAlias) {
                                targetRoomId = rooms[i].roomId;
                                break;
                            }
                        }
                        if (targetRoomId) { break; }
                    }
                    if (targetRoomId) { break; }
                }
                if (!targetRoomId) {
                    return reject("Unrecognised room alias: " + roomAlias);
                }
            }
        }
        if (!targetRoomId) targetRoomId = roomId;
        return success(
            MatrixClientPeg.get().leave(targetRoomId).then(
                function() {
                    dis.dispatch({action: 'view_next_room'});
                },
            ),
        );
    }),

    // Kick a user from the room with an optional reason
    kick: new Command("kick", "<userId> [<reason>]", function(roomId, args) {
        if (args) {
            const matches = args.match(/^(\S+?)( +(.*))?$/);
            if (matches) {
                return success(
                    MatrixClientPeg.get().kick(roomId, matches[1], matches[3]),
                );
            }
        }
        return reject(this.getUsage());
    }),

    // Ban a user from the room with an optional reason
    ban: new Command("ban", "<userId> [<reason>]", function(roomId, args) {
        if (args) {
            const matches = args.match(/^(\S+?)( +(.*))?$/);
            if (matches) {
                return success(
                    MatrixClientPeg.get().ban(roomId, matches[1], matches[3]),
                );
            }
        }
        return reject(this.getUsage());
    }),

    // Unban a user from the room
    unban: new Command("unban", "<userId>", function(roomId, args) {
        if (args) {
            const matches = args.match(/^(\S+)$/);
            if (matches) {
                // Reset the user membership to "leave" to unban him
                return success(
                    MatrixClientPeg.get().unban(roomId, matches[1]),
                );
            }
        }
        return reject(this.getUsage());
    }),

    // Define the power level of a user
    op: new Command("op", "<userId> [<power level>]", function(roomId, args) {
        if (args) {
            const matches = args.match(/^(\S+?)( +(\d+))?$/);
            let powerLevel = 50; // default power level for op
            if (matches) {
                const userId = matches[1];
                if (matches.length === 4 && undefined !== matches[3]) {
                    powerLevel = parseInt(matches[3]);
                }
                if (!isNaN(powerLevel)) {
                    const room = MatrixClientPeg.get().getRoom(roomId);
                    if (!room) {
                        return reject("Bad room ID: " + roomId);
                    }
                    const powerLevelEvent = room.currentState.getStateEvents(
                        "m.room.power_levels", "",
                    );
                    return success(
                        MatrixClientPeg.get().setPowerLevel(
                            roomId, userId, powerLevel, powerLevelEvent,
                        ),
                    );
                }
            }
        }
        return reject(this.getUsage());
    }),

    // Reset the power level of a user
    deop: new Command("deop", "<userId>", function(roomId, args) {
        if (args) {
            const matches = args.match(/^(\S+)$/);
            if (matches) {
                const room = MatrixClientPeg.get().getRoom(roomId);
                if (!room) {
                    return reject("Bad room ID: " + roomId);
                }

                const powerLevelEvent = room.currentState.getStateEvents(
                    "m.room.power_levels", "",
                );
                return success(
                    MatrixClientPeg.get().setPowerLevel(
                        roomId, args, undefined, powerLevelEvent,
                    ),
                );
            }
        }
        return reject(this.getUsage());
    }),

    // Verify a user, device, and pubkey tuple
    verify: new Command("verify", "<userId> <deviceId> <deviceSigningKey>", function(roomId, args) {
        if (args) {
            const matches = args.match(/^(\S+) +(\S+) +(\S+)$/);
            if (matches) {
                const userId = matches[1];
                const deviceId = matches[2];
                const fingerprint = matches[3];

                const device = MatrixClientPeg.get().getStoredDevice(userId, deviceId);
                if (!device) {
                    return reject(`Unknown (user, device) pair: (${userId}, ${deviceId})`);
                }

                if (device.isVerified()) {
                    if (device.getFingerprint() === fingerprint) {
                        return reject(`Device already verified!`);
                    } else {
                        return reject(`WARNING: Device already verified, but keys do NOT MATCH!`);
                    }
                }

                if (device.getFingerprint() === fingerprint) {
                    MatrixClientPeg.get().setDeviceVerified(
                        userId, deviceId, true,
                    );

                    // Tell the user we verified everything!
                    const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
                    Modal.createDialog(QuestionDialog, {
                        title: "Verified key",
                        description: (
                            <div>
                                <p>
                                    The signing key you provided matches the signing key you received
                                    from { userId }'s device { deviceId }. Device marked as verified.
                                </p>
                            </div>
                        ),
                        hasCancelButton: false,
                    });

                    return success();
                } else {
                    return reject(`WARNING: KEY VERIFICATION FAILED! The signing key for ${userId} and device
                            ${deviceId} is "${device.getFingerprint()}" which does not match the provided key
                            "${fingerprint}". This could mean your communications are being intercepted!`);
                }
            }
        }
        return reject(this.getUsage());
    }),
};
/* eslint-enable babel/no-invalid-this */


// helpful aliases
const aliases = {
    j: "join",
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
            const bits = input.match(/^(\S+?)( +((.|\n)*))?$/);
            let cmd;
            let args;
            if (bits) {
                cmd = bits[1].substring(1).toLowerCase();
                args = bits[3];
            } else {
                cmd = input;
            }
            if (cmd === "me") return null;
            if (aliases[cmd]) {
                cmd = aliases[cmd];
            }
            if (commands[cmd]) {
                return commands[cmd].run(roomId, args);
            } else {
                return reject("Unrecognised command: " + input);
            }
        }
        return null; // not a command
    },

    getCommandList: function() {
        // Return all the commands plus /me and /markdown which aren't handled like normal commands
        const cmds = Object.keys(commands).sort().map(function(cmdKey) {
            return commands[cmdKey];
        });
        cmds.push(new Command("me", "<action>", function() {}));
        cmds.push(new Command("markdown", "<on|off>", function() {}));

        return cmds;
    },
};

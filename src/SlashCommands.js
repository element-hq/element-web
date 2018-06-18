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


import React from 'react';
import MatrixClientPeg from './MatrixClientPeg';
import dis from './dispatcher';
import Tinter from './Tinter';
import sdk from './index';
import {_t, _td} from './languageHandler';
import Modal from './Modal';
import SettingsStore, {SettingLevel} from './settings/SettingsStore';


class Command {
    constructor({name, args='', description, runFn}) {
        this.command = name;
        this.args = args;
        this.description = description;
        this.runFn = runFn;
    }

    getCommand() {
        return "/" + this.command;
    }

    getCommandWithArgs() {
        return this.getCommand() + " " + this.args;
    }

    run(roomId, args) {
        return this.runFn.bind(this)(roomId, args);
    }

    getUsage() {
        return _t('Usage') + ': ' + this.getCommandWithArgs();
    }
}

function reject(error) {
    return {error};
}

function success(promise) {
    return {promise};
}

/* Disable the "unexpected this" error for these commands - all of the run
 * functions are called with `this` bound to the Command instance.
 */

/* eslint-disable babel/no-invalid-this */

export const CommandMap = {
    ddg: new Command({
        name: 'ddg',
        args: '<query>',
        description: _td('Searches DuckDuckGo for results'),
        runFn: function(roomId, args) {
            const ErrorDialog = sdk.getComponent('dialogs.ErrorDialog');
            // TODO Don't explain this away, actually show a search UI here.
            Modal.createTrackedDialog('Slash Commands', '/ddg is not a command', ErrorDialog, {
                title: _t('/ddg is not a command'),
                description: _t('To use it, just wait for autocomplete results to load and tab through them.'),
            });
            return success();
        },
    }),

    nick: new Command({
        name: 'nick',
        args: '<display_name>',
        description: _td('Changes your display nickname'),
        runFn: function(roomId, args) {
            if (args) {
                return success(MatrixClientPeg.get().setDisplayName(args));
            }
            return reject(this.getUsage());
        },
    }),

    tint: new Command({
        name: 'tint',
        args: '<color1> [<color2>]',
        description: _td('Changes colour scheme of current room'),
        runFn: function(roomId, args) {
            if (args) {
                const matches = args.match(/^(#([\da-fA-F]{3}|[\da-fA-F]{6}))( +(#([\da-fA-F]{3}|[\da-fA-F]{6})))?$/);
                if (matches) {
                    Tinter.tint(matches[1], matches[4]);
                    const colorScheme = {};
                    colorScheme.primary_color = matches[1];
                    if (matches[4]) {
                        colorScheme.secondary_color = matches[4];
                    } else {
                        colorScheme.secondary_color = colorScheme.primary_color;
                    }
                    return success(
                        SettingsStore.setValue('roomColor', roomId, SettingLevel.ROOM_ACCOUNT, colorScheme),
                    );
                }
            }
            return reject(this.getUsage());
        },
    }),

    topic: new Command({
        name: 'topic',
        args: '<topic>',
        description: _td('Sets the room topic'),
        runFn: function(roomId, args) {
            if (args) {
                return success(MatrixClientPeg.get().setRoomTopic(roomId, args));
            }
            return reject(this.getUsage());
        },
    }),

    invite: new Command({
        name: 'invite',
        args: '<user-id>',
        description: _td('Invites user with given id to current room'),
        runFn: function(roomId, args) {
            if (args) {
                const matches = args.match(/^(\S+)$/);
                if (matches) {
                    return success(MatrixClientPeg.get().invite(roomId, matches[1]));
                }
            }
            return reject(this.getUsage());
        },
    }),

    join: new Command({
        name: 'join',
        args: '<room-alias>',
        description: _td('Joins room with given alias'),
        runFn: function(roomId, args) {
            if (args) {
                const matches = args.match(/^(\S+)$/);
                if (matches) {
                    let roomAlias = matches[1];
                    if (roomAlias[0] !== '#') return reject(this.getUsage());

                    if (!roomAlias.includes(':')) {
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
        },
    }),

    part: new Command({
        name: 'part',
        args: '[<room-alias>]',
        description: _td('Leave room'),
        runFn: function(roomId, args) {
            const cli = MatrixClientPeg.get();

            let targetRoomId;
            if (args) {
                const matches = args.match(/^(\S+)$/);
                if (matches) {
                    let roomAlias = matches[1];
                    if (roomAlias[0] !== '#') return reject(this.getUsage());

                    if (!roomAlias.includes(':')) {
                        roomAlias += ':' + cli.getDomain();
                    }

                    // Try to find a room with this alias
                    const rooms = cli.getRooms();
                    for (let i = 0; i < rooms.length; i++) {
                        const aliasEvents = rooms[i].currentState.getStateEvents('m.room.aliases');
                        for (let j = 0; j < aliasEvents.length; j++) {
                            const aliases = aliasEvents[j].getContent().aliases || [];
                            for (let k = 0; k < aliases.length; k++) {
                                if (aliases[k] === roomAlias) {
                                    targetRoomId = rooms[i].roomId;
                                    break;
                                }
                            }
                            if (targetRoomId) break;
                        }
                        if (targetRoomId) break;
                    }
                    if (!targetRoomId) return reject(_t('Unrecognised room alias:') + ' ' + roomAlias);
                }
            }

            if (!targetRoomId) targetRoomId = roomId;
            return success(
                cli.leave(targetRoomId).then(function() {
                    dis.dispatch({action: 'view_next_room'});
                }),
            );
        },
    }),

    kick: new Command({
        name: 'kick',
        args: '<user-id> [reason]',
        description: _td('Kicks user with given id'),
        runFn: function(roomId, args) {
            if (args) {
                const matches = args.match(/^(\S+?)( +(.*))?$/);
                if (matches) {
                    return success(MatrixClientPeg.get().kick(roomId, matches[1], matches[3]));
                }
            }
            return reject(this.getUsage());
        },
    }),

    // Ban a user from the room with an optional reason
    ban: new Command({
        name: 'ban',
        args: '<user-id> [reason]',
        description: _td('Bans user with given id'),
        runFn: function(roomId, args) {
            if (args) {
                const matches = args.match(/^(\S+?)( +(.*))?$/);
                if (matches) {
                    return success(MatrixClientPeg.get().ban(roomId, matches[1], matches[3]));
                }
            }
            return reject(this.getUsage());
        },
    }),

    // Unban a user from ythe room
    unban: new Command({
        name: 'unban',
        args: '<user-id>',
        description: _td('Unbans user with given id'),
        runFn: function(roomId, args) {
            if (args) {
                const matches = args.match(/^(\S+)$/);
                if (matches) {
                    // Reset the user membership to "leave" to unban him
                    return success(MatrixClientPeg.get().unban(roomId, matches[1]));
                }
            }
            return reject(this.getUsage());
        },
    }),

    ignore: new Command({
        name: 'ignore',
        args: '<user-id>',
        description: _td('Ignores a user, hiding their messages from you'),
        runFn: function(roomId, args) {
            if (args) {
                const cli = MatrixClientPeg.get();

                const matches = args.match(/^(\S+)$/);
                if (matches) {
                    const userId = matches[1];
                    const ignoredUsers = cli.getIgnoredUsers();
                    ignoredUsers.push(userId); // de-duped internally in the js-sdk
                    return success(
                        cli.setIgnoredUsers(ignoredUsers).then(() => {
                            const QuestionDialog = sdk.getComponent('dialogs.QuestionDialog');
                            Modal.createTrackedDialog('Slash Commands', 'User ignored', QuestionDialog, {
                                title: _t('Ignored user'),
                                description: <div>
                                    <p>{ _t('You are now ignoring %(userId)s', {userId}) }</p>
                                </div>,
                                hasCancelButton: false,
                            });
                        }),
                    );
                }
            }
            return reject(this.getUsage());
        },
    }),

    unignore: new Command({
        name: 'unignore',
        args: '<user-id>',
        description: _td('Stops ignoring a user, showing their messages going forward'),
        runFn: function(roomId, args) {
            if (args) {
                const cli = MatrixClientPeg.get();

                const matches = args.match(/^(\S+)$/);
                if (matches) {
                    const userId = matches[1];
                    const ignoredUsers = cli.getIgnoredUsers();
                    const index = ignoredUsers.indexOf(userId);
                    if (index !== -1) ignoredUsers.splice(index, 1);
                    return success(
                        cli.setIgnoredUsers(ignoredUsers).then(() => {
                            const QuestionDialog = sdk.getComponent('dialogs.QuestionDialog');
                            Modal.createTrackedDialog('Slash Commands', 'User unignored', QuestionDialog, {
                                title: _t('Unignored user'),
                                description: <div>
                                    <p>{ _t('You are no longer ignoring %(userId)s', {userId}) }</p>
                                </div>,
                                hasCancelButton: false,
                            });
                        }),
                    );
                }
            }
            return reject(this.getUsage());
        },
    }),

    // Define the power level of a user
    op: new Command({
        name: 'op',
        args: '<user-id> [<power-level>]',
        description: _td('Define the power level of a user'),
        runFn: function(roomId, args) {
            if (args) {
                const matches = args.match(/^(\S+?)( +(-?\d+))?$/);
                let powerLevel = 50; // default power level for op
                if (matches) {
                    const userId = matches[1];
                    if (matches.length === 4 && undefined !== matches[3]) {
                        powerLevel = parseInt(matches[3]);
                    }
                    if (!isNaN(powerLevel)) {
                        const cli = MatrixClientPeg.get();
                        const room = cli.getRoom(roomId);
                        if (!room) return reject('Bad room ID: ' + roomId);

                        const powerLevelEvent = room.currentState.getStateEvents('m.room.power_levels', '');
                        return success(cli.setPowerLevel(roomId, userId, powerLevel, powerLevelEvent));
                    }
                }
            }
            return reject(this.getUsage());
        },
    }),

    // Reset the power level of a user
    deop: new Command({
        name: 'deop',
        args: '<user-id>',
        description: _td('Deops user with given id'),
        runFn: function(roomId, args) {
            if (args) {
                const matches = args.match(/^(\S+)$/);
                if (matches) {
                    const cli = MatrixClientPeg.get();
                    const room = cli.getRoom(roomId);
                    if (!room) return reject('Bad room ID: ' + roomId);

                    const powerLevelEvent = room.currentState.getStateEvents('m.room.power_levels', '');
                    return success(cli.setPowerLevel(roomId, args, undefined, powerLevelEvent));
                }
            }
            return reject(this.getUsage());
        },
    }),

    devtools: new Command({
        name: 'devtools',
        description: _td('Opens the Developer Tools dialog'),
        runFn: function(roomId) {
            const DevtoolsDialog = sdk.getComponent('dialogs.DevtoolsDialog');
            Modal.createDialog(DevtoolsDialog, {roomId});
            return success();
        },
    }),

    // Verify a user, device, and pubkey tuple
    verify: new Command({
        name: 'verify',
        args: '<user-id> <device-id> <device-signing-key>',
        description: _td('Verifies a user, device, and pubkey tuple'),
        runFn: function(roomId, args) {
            if (args) {
                const matches = args.match(/^(\S+) +(\S+) +(\S+)$/);
                if (matches) {
                    const cli = MatrixClientPeg.get();

                    const userId = matches[1];
                    const deviceId = matches[2];
                    const fingerprint = matches[3];

                    return success(
                        // Promise.resolve to handle transition from static result to promise; can be removed
                        // in future
                        Promise.resolve(cli.getStoredDevice(userId, deviceId)).then((device) => {
                            if (!device) {
                                throw new Error(_t('Unknown (user, device) pair:') + ` (${userId}, ${deviceId})`);
                            }

                            if (device.isVerified()) {
                                if (device.getFingerprint() === fingerprint) {
                                    throw new Error(_t('Device already verified!'));
                                } else {
                                    throw new Error(_t('WARNING: Device already verified, but keys do NOT MATCH!'));
                                }
                            }

                            if (device.getFingerprint() !== fingerprint) {
                                const fprint = device.getFingerprint();
                                throw new Error(
                                    _t('WARNING: KEY VERIFICATION FAILED! The signing key for %(userId)s and device' +
                                        ' %(deviceId)s is "%(fprint)s" which does not match the provided key ' +
                                        '"%(fingerprint)s". This could mean your communications are being intercepted!',
                                        {
                                            fprint,
                                            userId,
                                            deviceId,
                                            fingerprint,
                                        }));
                            }

                            return cli.setDeviceVerified(userId, deviceId, true);
                        }).then(() => {
                            // Tell the user we verified everything
                            const QuestionDialog = sdk.getComponent('dialogs.QuestionDialog');
                            Modal.createTrackedDialog('Slash Commands', 'Verified key', QuestionDialog, {
                                title: _t('Verified key'),
                                description: <div>
                                    <p>
                                        {
                                            _t('The signing key you provided matches the signing key you received ' +
                                                'from %(userId)s\'s device %(deviceId)s. Device marked as verified.',
                                                {userId, deviceId})
                                        }
                                    </p>
                                </div>,
                                hasCancelButton: false,
                            });
                        }),
                    );
                }
            }
            return reject(this.getUsage());
        },
    }),

    // Command definitions for autocompletion ONLY:

    // /me is special because its not handled by SlashCommands.js and is instead done inside the Composer classes
    me: new Command({
        name: 'me',
        args: '<message>',
        description: _td('Displays action'),
    }),
};
/* eslint-enable babel/no-invalid-this */


// helpful aliases
const aliases = {
    j: "join",
};

/**
 * Process the given text for /commands and perform them.
 * @param {string} roomId The room in which the command was performed.
 * @param {string} input The raw text input by the user.
 * @return {Object|null} An object with the property 'error' if there was an error
 * processing the command, or 'promise' if a request was sent out.
 * Returns null if the input didn't match a command.
 */
export function processCommandInput(roomId, input) {
    // trim any trailing whitespace, as it can confuse the parser for
    // IRC-style commands
    input = input.replace(/\s+$/, '');
    if (input[0] !== '/' || input[1] === '/') return null; // not a command

    const bits = input.match(/^(\S+?)( +((.|\n)*))?$/);
    let cmd;
    let args;
    if (bits) {
        cmd = bits[1].substring(1).toLowerCase();
        args = bits[3];
    } else {
        cmd = input;
    }

    if (aliases[cmd]) {
        cmd = aliases[cmd];
    }
    if (CommandMap[cmd]) {
        // if it has no runFn then its an ignored/nop command (autocomplete only) e.g `/me`
        if (!CommandMap[cmd].runFn) return null;

        return CommandMap[cmd].run(roomId, args);
    } else {
        return reject(_t('Unrecognised command:') + ' ' + input);
    }
}

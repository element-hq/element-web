/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd

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
import {MATRIXTO_URL_PATTERN} from "./linkify-matrix";
import * as querystring from "querystring";
import MultiInviter from './utils/MultiInviter';
import { linkifyAndSanitizeHtml } from './HtmlUtils';
import QuestionDialog from "./components/views/dialogs/QuestionDialog";
import WidgetUtils from "./utils/WidgetUtils";

class Command {
    constructor({name, args='', description, runFn, hideCompletionAfterSpace=false}) {
        this.command = '/' + name;
        this.args = args;
        this.description = description;
        this.runFn = runFn;
        this.hideCompletionAfterSpace = hideCompletionAfterSpace;
    }

    getCommand() {
        return this.command;
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
    shrug: new Command({
        name: 'shrug',
        args: '<message>',
        description: _td('Prepends ¯\\_(ツ)_/¯ to a plain-text message'),
        runFn: function(roomId, args) {
            let message = '¯\\_(ツ)_/¯';
            if (args) {
                message = message + ' ' + args;
            }
            return success(MatrixClientPeg.get().sendTextMessage(roomId, message));
        },
    }),

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
        hideCompletionAfterSpace: true,
    }),

    upgraderoom: new Command({
        name: 'upgraderoom',
        args: '<new_version>',
        description: _td('Upgrades a room to a new version'),
        runFn: function(roomId, args) {
            if (args) {
                const room = MatrixClientPeg.get().getRoom(roomId);
                Modal.createTrackedDialog('Slash Commands', 'upgrade room confirmation',
                    QuestionDialog, {
                    title: _t('Room upgrade confirmation'),
                    description: (
                        <div>
                            <p>{_t("Upgrading a room can be destructive and isn't always necessary.")}</p>
                            <p>
                                {_t(
                                    "Room upgrades are usually recommended when a room version is considered " +
                                    "<i>unstable</i>. Unstable room versions might have bugs, missing features, or " +
                                    "security vulnerabilities.",
                                    {}, {
                                        "i": (sub) => <i>{sub}</i>,
                                    },
                                )}
                            </p>
                            <p>
                                {_t(
                                    "Room upgrades usually only affect <i>server-side</i> processing of the " +
                                    "room. If you're having problems with your Riot client, please file an issue " +
                                    "with <issueLink />.",
                                    {}, {
                                        "i": (sub) => <i>{sub}</i>,
                                        "issueLink": () => {
                                            return <a href="https://github.com/vector-im/riot-web/issues/new/choose"
                                                      target="_blank" rel="noopener">
                                                https://github.com/vector-im/riot-web/issues/new/choose
                                            </a>;
                                        },
                                    },
                                )}
                            </p>
                            <p>
                                {_t(
                                    "<b>Warning</b>: Upgrading a room will <i>not automatically migrate room " +
                                    "members to the new version of the room.</i> We'll post a link to the new room " +
                                    "in the old version of the room - room members will have to click this link to " +
                                    "join the new room.",
                                    {}, {
                                        "b": (sub) => <b>{sub}</b>,
                                        "i": (sub) => <i>{sub}</i>,
                                    },
                                )}
                            </p>
                            <p>
                                {_t(
                                    "Please confirm that you'd like to go forward with upgrading this room " +
                                    "from <oldVersion /> to <newVersion />",
                                    {},
                                    {
                                        oldVersion: () => <code>{room ? room.getVersion() : "1"}</code>,
                                        newVersion: () => <code>{args}</code>,
                                    },
                                )}
                            </p>
                        </div>
                    ),
                    button: _t("Upgrade"),
                    onFinished: (confirm) => {
                        if (!confirm) return;

                        MatrixClientPeg.get().upgradeRoom(roomId, args);
                    },
                });
                return success();
            }
            return reject(this.getUsage());
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

    roomnick: new Command({
        name: 'roomnick',
        args: '<display_name>',
        description: _td('Changes your display nickname in the current room only'),
        runFn: function(roomId, args) {
            if (args) {
                const cli = MatrixClientPeg.get();
                const ev = cli.getRoom(roomId).currentState.getStateEvents('m.room.member', cli.getUserId());
                const content = {
                    ...ev ? ev.getContent() : { membership: 'join' },
                    displayname: args,
                };
                return success(cli.sendStateEvent(roomId, 'm.room.member', content, cli.getUserId()));
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
        args: '[<topic>]',
        description: _td('Gets or sets the room topic'),
        runFn: function(roomId, args) {
            const cli = MatrixClientPeg.get();
            if (args) {
                return success(cli.setRoomTopic(roomId, args));
            }
            const room = cli.getRoom(roomId);
            if (!room) return reject('Bad room ID: ' + roomId);

            const topicEvents = room.currentState.getStateEvents('m.room.topic', '');
            const topic = topicEvents && topicEvents.getContent().topic;
            const topicHtml = topic ? linkifyAndSanitizeHtml(topic) : _t('This room has no topic.');

            const InfoDialog = sdk.getComponent('dialogs.InfoDialog');
            Modal.createTrackedDialog('Slash Commands', 'Topic', InfoDialog, {
                title: room.name,
                description: <div dangerouslySetInnerHTML={{ __html: topicHtml }} />,
            });
            return success();
        },
    }),

    roomname: new Command({
        name: 'roomname',
        args: '<name>',
        description: _td('Sets the room name'),
        runFn: function(roomId, args) {
            if (args) {
                return success(MatrixClientPeg.get().setRoomName(roomId, args));
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
                    // We use a MultiInviter to re-use the invite logic, even though
                    // we're only inviting one user.
                    const userId = matches[1];
                    const inviter = new MultiInviter(roomId);
                    return success(inviter.invite([userId]).then(() => {
                        if (inviter.getCompletionState(userId) !== "invited") {
                            throw new Error(inviter.getErrorText(userId));
                        }
                    }));
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
                // Note: we support 2 versions of this command. The first is
                // the public-facing one for most users and the other is a
                // power-user edition where someone may join via permalink or
                // room ID with optional servers. Practically, this results
                // in the following variations:
                //   /join #example:example.org
                //   /join !example:example.org
                //   /join !example:example.org altserver.com elsewhere.ca
                //   /join https://matrix.to/#/!example:example.org?via=altserver.com
                // The command also supports event permalinks transparently:
                //   /join https://matrix.to/#/!example:example.org/$something:example.org
                //   /join https://matrix.to/#/!example:example.org/$something:example.org?via=altserver.com
                const params = args.split(' ');
                if (params.length < 1) return reject(this.getUsage());

                const matrixToMatches = params[0].match(MATRIXTO_URL_PATTERN);
                if (params[0][0] === '#') {
                    let roomAlias = params[0];
                    if (!roomAlias.includes(':')) {
                        roomAlias += ':' + MatrixClientPeg.get().getDomain();
                    }

                    dis.dispatch({
                        action: 'view_room',
                        room_alias: roomAlias,
                        auto_join: true,
                    });
                    return success();
                } else if (params[0][0] === '!') {
                    const roomId = params[0];
                    const viaServers = params.splice(0);

                    dis.dispatch({
                        action: 'view_room',
                        room_id: roomId,
                        opts: {
                            // These are passed down to the js-sdk's /join call
                            server_name: viaServers,
                        },
                        auto_join: true,
                    });
                    return success();
                } else if (matrixToMatches) {
                    let entity = matrixToMatches[1];
                    let eventId = null;
                    let viaServers = [];

                    if (entity[0] !== '!' && entity[0] !== '#') return reject(this.getUsage());

                    if (entity.indexOf('?') !== -1) {
                        const parts = entity.split('?');
                        entity = parts[0];

                        const parsed = querystring.parse(parts[1]);
                        viaServers = parsed["via"];
                        if (typeof viaServers === 'string') viaServers = [viaServers];
                    }

                    // We quietly support event ID permalinks too
                    if (entity.indexOf('/$') !== -1) {
                        const parts = entity.split("/$");
                        entity = parts[0];
                        eventId = `$${parts[1]}`;
                    }

                    const dispatch = {
                        action: 'view_room',
                        auto_join: true,
                    };

                    if (entity[0] === '!') dispatch["room_id"] = entity;
                    else dispatch["room_alias"] = entity;

                    if (eventId) {
                        dispatch["event_id"] = eventId;
                        dispatch["highlighted"] = true;
                    }

                    if (viaServers) {
                        dispatch["opts"] = {
                            // These are passed down to the js-sdk's /join call
                            server_name: viaServers,
                        };
                    }

                    dis.dispatch(dispatch);
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
                cli.leaveRoomChain(targetRoomId).then(function() {
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
                            const InfoDialog = sdk.getComponent('dialogs.InfoDialog');
                            Modal.createTrackedDialog('Slash Commands', 'User ignored', InfoDialog, {
                                title: _t('Ignored user'),
                                description: <div>
                                    <p>{ _t('You are now ignoring %(userId)s', {userId}) }</p>
                                </div>,
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
                            const InfoDialog = sdk.getComponent('dialogs.InfoDialog');
                            Modal.createTrackedDialog('Slash Commands', 'User unignored', InfoDialog, {
                                title: _t('Unignored user'),
                                description: <div>
                                    <p>{ _t('You are no longer ignoring %(userId)s', {userId}) }</p>
                                </div>,
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

    addwidget: new Command({
        name: 'addwidget',
        args: '<url>',
        description: _td('Adds a custom widget by URL to the room'),
        runFn: function(roomId, args) {
            if (!args || (!args.startsWith("https://") && !args.startsWith("http://"))) {
                return reject(_t("Please supply a https:// or http:// widget URL"));
            }
            if (WidgetUtils.canUserModifyWidgets(roomId)) {
                const userId = MatrixClientPeg.get().getUserId();
                const nowMs = (new Date()).getTime();
                const widgetId = encodeURIComponent(`${roomId}_${userId}_${nowMs}`);
                return success(WidgetUtils.setRoomWidget(
                    roomId, widgetId, "m.custom", args, "Custom Widget", {}));
            } else {
                return reject(_t("You cannot modify widgets in this room."));
            }
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
                            const InfoDialog = sdk.getComponent('dialogs.InfoDialog');
                            Modal.createTrackedDialog('Slash Commands', 'Verified key', InfoDialog, {
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
        hideCompletionAfterSpace: true,
    }),

    discardsession: new Command({
        name: 'discardsession',
        description: _td('Forces the current outbound group session in an encrypted room to be discarded'),
        runFn: function(roomId) {
            try {
                MatrixClientPeg.get().forceDiscardSession(roomId);
            } catch (e) {
                return reject(e.message);
            }
            return success();
        },
    }),
};
/* eslint-enable babel/no-invalid-this */


// helpful aliases
const aliases = {
    j: "join",
    newballsplease: "discardsession",
    goto: "join", // because it handles event permalinks magically
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
    if (input[0] !== '/') return null; // not a command

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

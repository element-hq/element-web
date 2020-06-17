/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2020 The Matrix.org Foundation C.I.C.

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


import * as React from 'react';

import {MatrixClientPeg} from './MatrixClientPeg';
import dis from './dispatcher/dispatcher';
import * as sdk from './index';
import {_t, _td} from './languageHandler';
import Modal from './Modal';
import MultiInviter from './utils/MultiInviter';
import { linkifyAndSanitizeHtml } from './HtmlUtils';
import QuestionDialog from "./components/views/dialogs/QuestionDialog";
import WidgetUtils from "./utils/WidgetUtils";
import {textToHtmlRainbow} from "./utils/colour";
import { getAddressType } from './UserAddress';
import { abbreviateUrl } from './utils/UrlUtils';
import { getDefaultIdentityServerUrl, useDefaultIdentityServer } from './utils/IdentityServerUtils';
import {isPermalinkHost, parsePermalink} from "./utils/permalinks/Permalinks";
import {inviteUsersToRoom} from "./RoomInvite";
import { WidgetType } from "./widgets/WidgetType";
import { Jitsi } from "./widgets/Jitsi";
import { parseFragment as parseHtml } from "parse5";
import sendBugReport from "./rageshake/submit-rageshake";
import SdkConfig from "./SdkConfig";
import { ensureDMExists } from "./createRoom";
import { ViewUserPayload } from "./dispatcher/payloads/ViewUserPayload";
import { Action } from "./dispatcher/actions";

// XXX: workaround for https://github.com/microsoft/TypeScript/issues/31816
interface HTMLInputEvent extends Event {
    target: HTMLInputElement & EventTarget;
}

const singleMxcUpload = async (): Promise<any> => {
    return new Promise((resolve) => {
        const fileSelector = document.createElement('input');
        fileSelector.setAttribute('type', 'file');
        fileSelector.onchange = (ev: HTMLInputEvent) => {
            const file = ev.target.files[0];

            const UploadConfirmDialog = sdk.getComponent("dialogs.UploadConfirmDialog");
            Modal.createTrackedDialog('Upload Files confirmation', '', UploadConfirmDialog, {
                file,
                onFinished: (shouldContinue) => {
                    resolve(shouldContinue ? MatrixClientPeg.get().uploadContent(file) : null);
                },
            });
        };

        fileSelector.click();
    });
};

export const CommandCategories = {
    "messages": _td("Messages"),
    "actions": _td("Actions"),
    "admin": _td("Admin"),
    "advanced": _td("Advanced"),
    "other": _td("Other"),
};

type RunFn = ((roomId: string, args: string, cmd: string) => {error: any} | {promise: Promise<any>});

interface ICommandOpts {
    command: string;
    aliases?: string[];
    args?: string;
    description: string;
    runFn?: RunFn;
    category: string;
    hideCompletionAfterSpace?: boolean;
}

export class Command {
    command: string;
    aliases: string[];
    args: undefined | string;
    description: string;
    runFn: undefined | RunFn;
    category: string;
    hideCompletionAfterSpace: boolean;

    constructor(opts: ICommandOpts) {
        this.command = opts.command;
        this.aliases = opts.aliases || [];
        this.args = opts.args || "";
        this.description = opts.description;
        this.runFn = opts.runFn;
        this.category = opts.category || CommandCategories.other;
        this.hideCompletionAfterSpace = opts.hideCompletionAfterSpace || false;
    }

    getCommand() {
        return `/${this.command}`;
    }

    getCommandWithArgs() {
        return this.getCommand() + " " + this.args;
    }

    run(roomId: string, args: string, cmd: string) {
        // if it has no runFn then its an ignored/nop command (autocomplete only) e.g `/me`
        if (!this.runFn) return reject(_t("Command error"));
        return this.runFn.bind(this)(roomId, args, cmd);
    }

    getUsage() {
        return _t('Usage') + ': ' + this.getCommandWithArgs();
    }
}

function reject(error) {
    return {error};
}

function success(promise?: Promise<any>) {
    return {promise};
}

/* Disable the "unexpected this" error for these commands - all of the run
 * functions are called with `this` bound to the Command instance.
 */

export const Commands = [
    new Command({
        command: 'shrug',
        args: '<message>',
        description: _td('Prepends ¯\\_(ツ)_/¯ to a plain-text message'),
        runFn: function(roomId, args) {
            let message = '¯\\_(ツ)_/¯';
            if (args) {
                message = message + ' ' + args;
            }
            return success(MatrixClientPeg.get().sendTextMessage(roomId, message));
        },
        category: CommandCategories.messages,
    }),
    new Command({
        command: 'plain',
        args: '<message>',
        description: _td('Sends a message as plain text, without interpreting it as markdown'),
        runFn: function(roomId, messages) {
            return success(MatrixClientPeg.get().sendTextMessage(roomId, messages));
        },
        category: CommandCategories.messages,
    }),
    new Command({
        command: 'html',
        args: '<message>',
        description: _td('Sends a message as html, without interpreting it as markdown'),
        runFn: function(roomId, messages) {
            return success(MatrixClientPeg.get().sendHtmlMessage(roomId, messages, messages));
        },
        category: CommandCategories.messages,
    }),
    new Command({
        command: 'ddg',
        args: '<query>',
        description: _td('Searches DuckDuckGo for results'),
        runFn: function() {
            const ErrorDialog = sdk.getComponent('dialogs.ErrorDialog');
            // TODO Don't explain this away, actually show a search UI here.
            Modal.createTrackedDialog('Slash Commands', '/ddg is not a command', ErrorDialog, {
                title: _t('/ddg is not a command'),
                description: _t('To use it, just wait for autocomplete results to load and tab through them.'),
            });
            return success();
        },
        category: CommandCategories.actions,
        hideCompletionAfterSpace: true,
    }),
    new Command({
        command: 'upgraderoom',
        args: '<new_version>',
        description: _td('Upgrades a room to a new version'),
        runFn: function(roomId, args) {
            if (args) {
                const cli = MatrixClientPeg.get();
                const room = cli.getRoom(roomId);
                if (!room.currentState.mayClientSendStateEvent("m.room.tombstone", cli)) {
                    return reject(_t("You do not have the required permissions to use this command."));
                }

                const RoomUpgradeWarningDialog = sdk.getComponent("dialogs.RoomUpgradeWarningDialog");

                const {finished} = Modal.createTrackedDialog('Slash Commands', 'upgrade room confirmation',
                    RoomUpgradeWarningDialog, {roomId: roomId, targetVersion: args}, /*className=*/null,
                    /*isPriority=*/false, /*isStatic=*/true);

                return success(finished.then(async ([resp]) => {
                    if (!resp.continue) return;

                    let checkForUpgradeFn;
                    try {
                        const upgradePromise = cli.upgradeRoom(roomId, args);

                        // We have to wait for the js-sdk to give us the room back so
                        // we can more effectively abuse the MultiInviter behaviour
                        // which heavily relies on the Room object being available.
                        if (resp.invite) {
                            checkForUpgradeFn = async (newRoom) => {
                                // The upgradePromise should be done by the time we await it here.
                                const {replacement_room: newRoomId} = await upgradePromise;
                                if (newRoom.roomId !== newRoomId) return;

                                const toInvite = [
                                    ...room.getMembersWithMembership("join"),
                                    ...room.getMembersWithMembership("invite"),
                                ].map(m => m.userId).filter(m => m !== cli.getUserId());

                                if (toInvite.length > 0) {
                                    // Errors are handled internally to this function
                                    await inviteUsersToRoom(newRoomId, toInvite);
                                }

                                cli.removeListener('Room', checkForUpgradeFn);
                            };
                            cli.on('Room', checkForUpgradeFn);
                        }

                        // We have to await after so that the checkForUpgradesFn has a proper reference
                        // to the new room's ID.
                        await upgradePromise;
                    } catch (e) {
                        console.error(e);

                        if (checkForUpgradeFn) cli.removeListener('Room', checkForUpgradeFn);

                        const ErrorDialog = sdk.getComponent('dialogs.ErrorDialog');
                        Modal.createTrackedDialog('Slash Commands', 'room upgrade error', ErrorDialog, {
                            title: _t('Error upgrading room'),
                            description: _t(
                                'Double check that your server supports the room version chosen and try again.'),
                        });
                    }
                }));
            }
            return reject(this.getUsage());
        },
        category: CommandCategories.admin,
    }),
    new Command({
        command: 'nick',
        args: '<display_name>',
        description: _td('Changes your display nickname'),
        runFn: function(roomId, args) {
            if (args) {
                return success(MatrixClientPeg.get().setDisplayName(args));
            }
            return reject(this.getUsage());
        },
        category: CommandCategories.actions,
    }),
    new Command({
        command: 'myroomnick',
        aliases: ['roomnick'],
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
        category: CommandCategories.actions,
    }),
    new Command({
        command: 'roomavatar',
        args: '[<mxc_url>]',
        description: _td('Changes the avatar of the current room'),
        runFn: function(roomId, args) {
            let promise = Promise.resolve(args);
            if (!args) {
                promise = singleMxcUpload();
            }

            return success(promise.then((url) => {
                if (!url) return;
                return MatrixClientPeg.get().sendStateEvent(roomId, 'm.room.avatar', {url}, '');
            }));
        },
        category: CommandCategories.actions,
    }),
    new Command({
        command: 'myroomavatar',
        args: '[<mxc_url>]',
        description: _td('Changes your avatar in this current room only'),
        runFn: function(roomId, args) {
            const cli = MatrixClientPeg.get();
            const room = cli.getRoom(roomId);
            const userId = cli.getUserId();

            let promise = Promise.resolve(args);
            if (!args) {
                promise = singleMxcUpload();
            }

            return success(promise.then((url) => {
                if (!url) return;
                const ev = room.currentState.getStateEvents('m.room.member', userId);
                const content = {
                    ...ev ? ev.getContent() : { membership: 'join' },
                    avatar_url: url,
                };
                return cli.sendStateEvent(roomId, 'm.room.member', content, userId);
            }));
        },
        category: CommandCategories.actions,
    }),
    new Command({
        command: 'myavatar',
        args: '[<mxc_url>]',
        description: _td('Changes your avatar in all rooms'),
        runFn: function(roomId, args) {
            let promise = Promise.resolve(args);
            if (!args) {
                promise = singleMxcUpload();
            }

            return success(promise.then((url) => {
                if (!url) return;
                return MatrixClientPeg.get().setAvatarUrl(url);
            }));
        },
        category: CommandCategories.actions,
    }),
    new Command({
        command: 'topic',
        args: '[<topic>]',
        description: _td('Gets or sets the room topic'),
        runFn: function(roomId, args) {
            const cli = MatrixClientPeg.get();
            if (args) {
                return success(cli.setRoomTopic(roomId, args));
            }
            const room = cli.getRoom(roomId);
            if (!room) return reject(_t("Failed to set topic"));

            const topicEvents = room.currentState.getStateEvents('m.room.topic', '');
            const topic = topicEvents && topicEvents.getContent().topic;
            const topicHtml = topic ? linkifyAndSanitizeHtml(topic) : _t('This room has no topic.');

            const InfoDialog = sdk.getComponent('dialogs.InfoDialog');
            Modal.createTrackedDialog('Slash Commands', 'Topic', InfoDialog, {
                title: room.name,
                description: <div dangerouslySetInnerHTML={{ __html: topicHtml }} />,
                hasCloseButton: true,
            });
            return success();
        },
        category: CommandCategories.admin,
    }),
    new Command({
        command: 'roomname',
        args: '<name>',
        description: _td('Sets the room name'),
        runFn: function(roomId, args) {
            if (args) {
                return success(MatrixClientPeg.get().setRoomName(roomId, args));
            }
            return reject(this.getUsage());
        },
        category: CommandCategories.admin,
    }),
    new Command({
        command: 'invite',
        args: '<user-id>',
        description: _td('Invites user with given id to current room'),
        runFn: function(roomId, args) {
            if (args) {
                const matches = args.match(/^(\S+)$/);
                if (matches) {
                    // We use a MultiInviter to re-use the invite logic, even though
                    // we're only inviting one user.
                    const address = matches[1];
                    // If we need an identity server but don't have one, things
                    // get a bit more complex here, but we try to show something
                    // meaningful.
                    let finished = Promise.resolve();
                    if (
                        getAddressType(address) === 'email' &&
                        !MatrixClientPeg.get().getIdentityServerUrl()
                    ) {
                        const defaultIdentityServerUrl = getDefaultIdentityServerUrl();
                        if (defaultIdentityServerUrl) {
                            ({ finished } = Modal.createTrackedDialog('Slash Commands', 'Identity server',
                                QuestionDialog, {
                                    title: _t("Use an identity server"),
                                    description: <p>{_t(
                                        "Use an identity server to invite by email. " +
                                        "Click continue to use the default identity server " +
                                        "(%(defaultIdentityServerName)s) or manage in Settings.",
                                        {
                                            defaultIdentityServerName: abbreviateUrl(defaultIdentityServerUrl),
                                        },
                                    )}</p>,
                                    button: _t("Continue"),
                                },
                            ));

                            finished = finished.then(([useDefault]: any) => {
                                if (useDefault) {
                                    useDefaultIdentityServer();
                                    return;
                                }
                                throw new Error(_t("Use an identity server to invite by email. Manage in Settings."));
                            });
                        } else {
                            return reject(_t("Use an identity server to invite by email. Manage in Settings."));
                        }
                    }
                    const inviter = new MultiInviter(roomId);
                    return success(finished.then(() => {
                        return inviter.invite([address]);
                    }).then(() => {
                        if (inviter.getCompletionState(address) !== "invited") {
                            throw new Error(inviter.getErrorText(address));
                        }
                    }));
                }
            }
            return reject(this.getUsage());
        },
        category: CommandCategories.actions,
    }),
    new Command({
        command: 'join',
        aliases: ['j', 'goto'],
        args: '<room-address>',
        description: _td('Joins room with given address'),
        runFn: function(_, args) {
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

                let isPermalink = false;
                if (params[0].startsWith("http:") || params[0].startsWith("https:")) {
                    // It's at least a URL - try and pull out a hostname to check against the
                    // permalink handler
                    const parsedUrl = new URL(params[0]);
                    const hostname = parsedUrl.host || parsedUrl.hostname; // takes first non-falsey value

                    // if we're using a Riot permalink handler, this will catch it before we get much further.
                    // see below where we make assumptions about parsing the URL.
                    if (isPermalinkHost(hostname)) {
                        isPermalink = true;
                    }
                }
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
                            viaServers: viaServers,
                        },
                        via_servers: viaServers, // for the rejoin button
                        auto_join: true,
                    });
                    return success();
                } else if (isPermalink) {
                    const permalinkParts = parsePermalink(params[0]);

                    // This check technically isn't needed because we already did our
                    // safety checks up above. However, for good measure, let's be sure.
                    if (!permalinkParts) {
                        return reject(this.getUsage());
                    }

                    // If for some reason someone wanted to join a group or user, we should
                    // stop them now.
                    if (!permalinkParts.roomIdOrAlias) {
                        return reject(this.getUsage());
                    }

                    const entity = permalinkParts.roomIdOrAlias;
                    const viaServers = permalinkParts.viaServers;
                    const eventId = permalinkParts.eventId;

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
                        // For the join
                        dispatch["opts"] = {
                            // These are passed down to the js-sdk's /join call
                            viaServers: viaServers,
                        };

                        // For if the join fails (rejoin button)
                        dispatch['via_servers'] = viaServers;
                    }

                    dis.dispatch(dispatch);
                    return success();
                }
            }
            return reject(this.getUsage());
        },
        category: CommandCategories.actions,
    }),
    new Command({
        command: 'part',
        args: '[<room-address>]',
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
                    if (!targetRoomId) return reject(_t('Unrecognised room address:') + ' ' + roomAlias);
                }
            }

            if (!targetRoomId) targetRoomId = roomId;
            return success(
                cli.leaveRoomChain(targetRoomId).then(function() {
                    dis.dispatch({action: 'view_next_room'});
                }),
            );
        },
        category: CommandCategories.actions,
    }),
    new Command({
        command: 'kick',
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
        category: CommandCategories.admin,
    }),
    new Command({
        command: 'ban',
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
        category: CommandCategories.admin,
    }),
    new Command({
        command: 'unban',
        args: '<user-id>',
        description: _td('Unbans user with given ID'),
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
        category: CommandCategories.admin,
    }),
    new Command({
        command: 'ignore',
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
        category: CommandCategories.actions,
    }),
    new Command({
        command: 'unignore',
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
        category: CommandCategories.actions,
    }),
    new Command({
        command: 'op',
        args: '<user-id> [<power-level>]',
        description: _td('Define the power level of a user'),
        runFn: function(roomId, args) {
            if (args) {
                const matches = args.match(/^(\S+?)( +(-?\d+))?$/);
                let powerLevel = 50; // default power level for op
                if (matches) {
                    const userId = matches[1];
                    if (matches.length === 4 && undefined !== matches[3]) {
                        powerLevel = parseInt(matches[3], 10);
                    }
                    if (!isNaN(powerLevel)) {
                        const cli = MatrixClientPeg.get();
                        const room = cli.getRoom(roomId);
                        if (!room) return reject(_t("Command failed"));

                        const powerLevelEvent = room.currentState.getStateEvents('m.room.power_levels', '');
                        if (!powerLevelEvent.getContent().users[args]) return reject(_t("Could not find user in room"));
                        return success(cli.setPowerLevel(roomId, userId, powerLevel, powerLevelEvent));
                    }
                }
            }
            return reject(this.getUsage());
        },
        category: CommandCategories.admin,
    }),
    new Command({
        command: 'deop',
        args: '<user-id>',
        description: _td('Deops user with given id'),
        runFn: function(roomId, args) {
            if (args) {
                const matches = args.match(/^(\S+)$/);
                if (matches) {
                    const cli = MatrixClientPeg.get();
                    const room = cli.getRoom(roomId);
                    if (!room) return reject(_t("Command failed"));

                    const powerLevelEvent = room.currentState.getStateEvents('m.room.power_levels', '');
                    if (!powerLevelEvent.getContent().users[args]) return reject(_t("Could not find user in room"));
                    return success(cli.setPowerLevel(roomId, args, undefined, powerLevelEvent));
                }
            }
            return reject(this.getUsage());
        },
        category: CommandCategories.admin,
    }),
    new Command({
        command: 'devtools',
        description: _td('Opens the Developer Tools dialog'),
        runFn: function(roomId) {
            const DevtoolsDialog = sdk.getComponent('dialogs.DevtoolsDialog');
            Modal.createDialog(DevtoolsDialog, {roomId});
            return success();
        },
        category: CommandCategories.advanced,
    }),
    new Command({
        command: 'addwidget',
        args: '<url | embed code | Jitsi url>',
        description: _td('Adds a custom widget by URL to the room'),
        runFn: function(roomId, widgetUrl) {
            if (!widgetUrl) {
                return reject(_t("Please supply a widget URL or embed code"));
            }

            // Try and parse out a widget URL from iframes
            if (widgetUrl.toLowerCase().startsWith("<iframe ")) {
                // We use parse5, which doesn't render/create a DOM node. It instead runs
                // some superfast regex over the text so we don't have to.
                const embed = parseHtml(widgetUrl);
                if (embed && embed.childNodes && embed.childNodes.length === 1) {
                    const iframe = embed.childNodes[0];
                    if (iframe.tagName.toLowerCase() === 'iframe' && iframe.attrs) {
                        const srcAttr = iframe.attrs.find(a => a.name === 'src');
                        console.log("Pulling URL out of iframe (embed code)");
                        widgetUrl = srcAttr.value;
                    }
                }
            }

            if (!widgetUrl.startsWith("https://") && !widgetUrl.startsWith("http://")) {
                return reject(_t("Please supply a https:// or http:// widget URL"));
            }
            if (WidgetUtils.canUserModifyWidgets(roomId)) {
                const userId = MatrixClientPeg.get().getUserId();
                const nowMs = (new Date()).getTime();
                const widgetId = encodeURIComponent(`${roomId}_${userId}_${nowMs}`);
                let type = WidgetType.CUSTOM;
                let name = "Custom Widget";
                let data = {};

                // Make the widget a Jitsi widget if it looks like a Jitsi widget
                const jitsiData = Jitsi.getInstance().parsePreferredConferenceUrl(widgetUrl);
                if (jitsiData) {
                    console.log("Making /addwidget widget a Jitsi conference");
                    type = WidgetType.JITSI;
                    name = "Jitsi Conference";
                    data = jitsiData;
                    widgetUrl = WidgetUtils.getLocalJitsiWrapperUrl();
                }

                return success(WidgetUtils.setRoomWidget(roomId, widgetId, type, widgetUrl, name, data));
            } else {
                return reject(_t("You cannot modify widgets in this room."));
            }
        },
        category: CommandCategories.admin,
    }),
    new Command({
        command: 'verify',
        args: '<user-id> <device-id> <device-signing-key>',
        description: _td('Verifies a user, session, and pubkey tuple'),
        runFn: function(roomId, args) {
            if (args) {
                const matches = args.match(/^(\S+) +(\S+) +(\S+)$/);
                if (matches) {
                    const cli = MatrixClientPeg.get();

                    const userId = matches[1];
                    const deviceId = matches[2];
                    const fingerprint = matches[3];

                    return success((async () => {
                        const device = cli.getStoredDevice(userId, deviceId);
                        if (!device) {
                            throw new Error(_t('Unknown (user, session) pair:') + ` (${userId}, ${deviceId})`);
                        }
                        const deviceTrust = await cli.checkDeviceTrust(userId, deviceId);

                        if (deviceTrust.isVerified()) {
                            if (device.getFingerprint() === fingerprint) {
                                throw new Error(_t('Session already verified!'));
                            } else {
                                throw new Error(_t('WARNING: Session already verified, but keys do NOT MATCH!'));
                            }
                        }

                        if (device.getFingerprint() !== fingerprint) {
                            const fprint = device.getFingerprint();
                            throw new Error(
                                _t('WARNING: KEY VERIFICATION FAILED! The signing key for %(userId)s and session' +
                                    ' %(deviceId)s is "%(fprint)s" which does not match the provided key ' +
                                    '"%(fingerprint)s". This could mean your communications are being intercepted!',
                                    {
                                        fprint,
                                        userId,
                                        deviceId,
                                        fingerprint,
                                    }));
                        }

                        await cli.setDeviceVerified(userId, deviceId, true);

                        // Tell the user we verified everything
                        const InfoDialog = sdk.getComponent('dialogs.InfoDialog');
                        Modal.createTrackedDialog('Slash Commands', 'Verified key', InfoDialog, {
                            title: _t('Verified key'),
                            description: <div>
                                <p>
                                    {
                                        _t('The signing key you provided matches the signing key you received ' +
                                            'from %(userId)s\'s session %(deviceId)s. Session marked as verified.',
                                            {userId, deviceId})
                                    }
                                </p>
                            </div>,
                        });
                    })());
                }
            }
            return reject(this.getUsage());
        },
        category: CommandCategories.advanced,
    }),
    new Command({
        command: 'discardsession',
        description: _td('Forces the current outbound group session in an encrypted room to be discarded'),
        runFn: function(roomId) {
            try {
                MatrixClientPeg.get().forceDiscardSession(roomId);
            } catch (e) {
                return reject(e.message);
            }
            return success();
        },
        category: CommandCategories.advanced,
    }),
    new Command({
        command: "rainbow",
        description: _td("Sends the given message coloured as a rainbow"),
        args: '<message>',
        runFn: function(roomId, args) {
            if (!args) return reject(this.getUserId());
            return success(MatrixClientPeg.get().sendHtmlMessage(roomId, args, textToHtmlRainbow(args)));
        },
        category: CommandCategories.messages,
    }),
    new Command({
        command: "rainbowme",
        description: _td("Sends the given emote coloured as a rainbow"),
        args: '<message>',
        runFn: function(roomId, args) {
            if (!args) return reject(this.getUserId());
            return success(MatrixClientPeg.get().sendHtmlEmote(roomId, args, textToHtmlRainbow(args)));
        },
        category: CommandCategories.messages,
    }),
    new Command({
        command: "help",
        description: _td("Displays list of commands with usages and descriptions"),
        runFn: function() {
            const SlashCommandHelpDialog = sdk.getComponent('dialogs.SlashCommandHelpDialog');

            Modal.createTrackedDialog('Slash Commands', 'Help', SlashCommandHelpDialog);
            return success();
        },
        category: CommandCategories.advanced,
    }),
    new Command({
        command: "whois",
        description: _td("Displays information about a user"),
        args: "<user-id>",
        runFn: function(roomId, userId) {
            if (!userId || !userId.startsWith("@") || !userId.includes(":")) {
                return reject(this.getUsage());
            }

            const member = MatrixClientPeg.get().getRoom(roomId).getMember(userId);
            dis.dispatch<ViewUserPayload>({
                action: Action.ViewUser,
                // XXX: We should be using a real member object and not assuming what the
                // receiver wants.
                member: member || {userId},
            });
            return success();
        },
        category: CommandCategories.advanced,
    }),
    new Command({
        command: "rageshake",
        aliases: ["bugreport"],
        description: _td("Send a bug report with logs"),
        args: "<description>",
        runFn: function(roomId, args) {
            return success(
                sendBugReport(SdkConfig.get().bug_report_endpoint_url, {
                    userText: args,
                    sendLogs: true,
                }).then(() => {
                    const InfoDialog = sdk.getComponent('dialogs.InfoDialog');
                    Modal.createTrackedDialog('Slash Commands', 'Rageshake sent', InfoDialog, {
                        title: _t('Logs sent'),
                        description: _t('Thank you!'),
                    });
                }),
            );
        },
        category: CommandCategories.advanced,
    }),
    new Command({
        command: "query",
        description: _td("Opens chat with the given user"),
        args: "<user-id>",
        runFn: function(roomId, userId) {
            if (!userId || !userId.startsWith("@") || !userId.includes(":")) {
                return reject(this.getUsage());
            }

            return success((async () => {
                dis.dispatch({
                    action: 'view_room',
                    room_id: await ensureDMExists(MatrixClientPeg.get(), userId),
                });
            })());
        },
        category: CommandCategories.actions,
    }),
    new Command({
        command: "msg",
        description: _td("Sends a message to the given user"),
        args: "<user-id> <message>",
        runFn: function(_, args) {
            if (args) {
                // matches the first whitespace delimited group and then the rest of the string
                const matches = args.match(/^(\S+?)(?: +(.*))?$/s);
                if (matches) {
                    const [userId, msg] = matches.slice(1);
                    if (msg && userId && userId.startsWith("@") && userId.includes(":")) {
                        return success((async () => {
                            const cli = MatrixClientPeg.get();
                            const roomId = await ensureDMExists(cli, userId);
                            dis.dispatch({
                                action: 'view_room',
                                room_id: roomId,
                            });
                            cli.sendTextMessage(roomId, msg);
                        })());
                    }
                }
            }

            return reject(this.getUsage());
        },
        category: CommandCategories.actions,
    }),

    // Command definitions for autocompletion ONLY:
    // /me is special because its not handled by SlashCommands.js and is instead done inside the Composer classes
    new Command({
        command: "me",
        args: '<message>',
        description: _td('Displays action'),
        category: CommandCategories.messages,
        hideCompletionAfterSpace: true,
    }),
];

// build a map from names and aliases to the Command objects.
export const CommandMap = new Map();
Commands.forEach(cmd => {
    CommandMap.set(cmd.command, cmd);
    cmd.aliases.forEach(alias => {
        CommandMap.set(alias, cmd);
    });
});

export function parseCommandString(input) {
    // trim any trailing whitespace, as it can confuse the parser for
    // IRC-style commands
    input = input.replace(/\s+$/, '');
    if (input[0] !== '/') return null; // not a command

    const bits = input.match(/^(\S+?)(?: +((.|\n)*))?$/);
    let cmd;
    let args;
    if (bits) {
        cmd = bits[1].substring(1).toLowerCase();
        args = bits[2];
    } else {
        cmd = input;
    }

    return {cmd, args};
}

/**
 * Process the given text for /commands and return a bound method to perform them.
 * @param {string} roomId The room in which the command was performed.
 * @param {string} input The raw text input by the user.
 * @return {null|function(): Object} Function returning an object with the property 'error' if there was an error
 * processing the command, or 'promise' if a request was sent out.
 * Returns null if the input didn't match a command.
 */
export function getCommand(roomId, input) {
    const {cmd, args} = parseCommandString(input);

    if (CommandMap.has(cmd)) {
        return () => CommandMap.get(cmd).run(roomId, args, cmd);
    }
}

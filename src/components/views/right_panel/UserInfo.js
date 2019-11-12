/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 Vector Creations Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React, {useCallback, useMemo, useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {Group, RoomMember, User} from 'matrix-js-sdk';
import dis from '../../../dispatcher';
import Modal from '../../../Modal';
import sdk from '../../../index';
import { _t } from '../../../languageHandler';
import createRoom from '../../../createRoom';
import DMRoomMap from '../../../utils/DMRoomMap';
import Unread from '../../../Unread';
import AccessibleButton from '../elements/AccessibleButton';
import SdkConfig from '../../../SdkConfig';
import SettingsStore from "../../../settings/SettingsStore";
import {EventTimeline} from "matrix-js-sdk";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import * as RoomViewStore from "../../../stores/RoomViewStore";
import MultiInviter from "../../../utils/MultiInviter";
import GroupStore from "../../../stores/GroupStore";
import MatrixClientPeg from "../../../MatrixClientPeg";
import E2EIcon from "../rooms/E2EIcon";
import withLegacyMatrixClient from "../../../utils/withLegacyMatrixClient";
import {useEventEmitter} from "../../../hooks/useEventEmitter";
import {ContentRepo} from 'matrix-js-sdk';

const _disambiguateDevices = (devices) => {
    const names = Object.create(null);
    for (let i = 0; i < devices.length; i++) {
        const name = devices[i].getDisplayName();
        const indexList = names[name] || [];
        indexList.push(i);
        names[name] = indexList;
    }
    for (const name in names) {
        if (names[name].length > 1) {
            names[name].forEach((j)=>{
                devices[j].ambiguous = true;
            });
        }
    }
};

const _getE2EStatus = (devices) => {
    const hasUnverifiedDevice = devices.some((device) => device.isUnverified());
    return hasUnverifiedDevice ? "warning" : "verified";
};

const DevicesSection = ({devices, userId, loading}) => {
    const MemberDeviceInfo = sdk.getComponent('rooms.MemberDeviceInfo');
    const Spinner = sdk.getComponent("elements.Spinner");

    if (loading) {
        // still loading
        return <Spinner />;
    }
    if (devices === null) {
        return _t("Unable to load device list");
    }
    if (devices.length === 0) {
        return _t("No devices with registered encryption keys");
    }

    return (
        <div className="mx_UserInfo_container">
            <h3>{ _t("Trust & Devices") }</h3>
            <div className="mx_UserInfo_devices">
                { devices.map((device, i) => <MemberDeviceInfo key={i} userId={userId} device={device} />) }
            </div>
        </div>
    );
};

const onRoomTileClick = (roomId) => {
    dis.dispatch({
        action: 'view_room',
        room_id: roomId,
    });
};

const DirectChatsSection = withLegacyMatrixClient(({matrixClient: cli, userId, startUpdating, stopUpdating}) => {
    const onNewDMClick = async () => {
        startUpdating();
        await createRoom({dmUserId: userId});
        stopUpdating();
    };

    // TODO: Immutable DMs replaces a lot of this
    // dmRooms will not include dmRooms that we have been invited into but did not join.
    // Because DMRoomMap runs off account_data[m.direct] which is only set on join of dm room.
    // XXX: we potentially want DMs we have been invited to, to also show up here :L
    // especially as logic below concerns specially if we haven't joined but have been invited
    const [dmRooms, setDmRooms] = useState(new DMRoomMap(cli).getDMRoomsForUserId(userId));

    // TODO bind the below
    // cli.on("Room", this.onRoom);
    // cli.on("Room.name", this.onRoomName);
    // cli.on("deleteRoom", this.onDeleteRoom);

    const accountDataHandler = useCallback((ev) => {
        if (ev.getType() === "m.direct") {
            const dmRoomMap = new DMRoomMap(cli);
            setDmRooms(dmRoomMap.getDMRoomsForUserId(userId));
        }
    }, [cli, userId]);
    useEventEmitter(cli, "accountData", accountDataHandler);

    const RoomTile = sdk.getComponent("rooms.RoomTile");

    const tiles = [];
    for (const roomId of dmRooms) {
        const room = cli.getRoom(roomId);
        if (room) {
            const myMembership = room.getMyMembership();
            // not a DM room if we have are not joined
            if (myMembership !== 'join') continue;

            const them = room.getMember(userId);
            // not a DM room if they are not joined
            if (!them || !them.membership || them.membership !== 'join') continue;

            const highlight = room.getUnreadNotificationCount('highlight') > 0;

            tiles.push(
                <RoomTile key={room.roomId}
                          room={room}
                          transparent={true}
                          collapsed={false}
                          selected={false}
                          unread={Unread.doesRoomHaveUnreadMessages(room)}
                          highlight={highlight}
                          isInvite={false}
                          onClick={onRoomTileClick}
                />,
            );
        }
    }

    const labelClasses = classNames({
        mx_UserInfo_createRoom_label: true,
        mx_RoomTile_name: true,
    });

    let body = tiles;
    if (!body) {
        body = (
            <AccessibleButton className="mx_UserInfo_createRoom" onClick={onNewDMClick}>
                <div className="mx_RoomTile_avatar">
                    <img src={require("../../../../res/img/create-big.svg")} width="26" height="26" alt={_t("Start a chat")} />
                </div>
                <div className={labelClasses}><i>{ _t("Start a chat") }</i></div>
            </AccessibleButton>
        );
    }

    return (
        <div className="mx_UserInfo_container">
            <div className="mx_UserInfo_container_header">
                <h3>{ _t("Direct messages") }</h3>
                <AccessibleButton
                    className="mx_UserInfo_container_header_right mx_UserInfo_newDmButton"
                    onClick={onNewDMClick}
                    title={_t("Start a chat")}
                />
            </div>
            { body }
        </div>
    );
});

function openDMForUser(cli, userId) {
    const dmRooms = DMRoomMap.shared().getDMRoomsForUserId(userId);
    const lastActiveRoom = dmRooms.reduce((lastActiveRoom, roomId) => {
        const room = cli.getRoom(roomId);
        if (!lastActiveRoom || (room && lastActiveRoom.getLastActiveTimestamp() < room.getLastActiveTimestamp())) {
            return room;
        }
        return lastActiveRoom;
    }, null);

    if (lastActiveRoom) {
        dis.dispatch({
            action: 'view_room',
            room_id: lastActiveRoom.roomId,
        });
    } else {
        createRoom({dmUserId: userId});
    }
}

const UserOptionsSection = withLegacyMatrixClient(({matrixClient: cli, member, isIgnored, canInvite}) => {
    let ignoreButton = null;
    let insertPillButton = null;
    let inviteUserButton = null;
    let readReceiptButton = null;

    const onShareUserClick = () => {
        const ShareDialog = sdk.getComponent("dialogs.ShareDialog");
        Modal.createTrackedDialog('share room member dialog', '', ShareDialog, {
            target: member,
        });
    };

    // Only allow the user to ignore the user if its not ourselves
    // same goes for jumping to read receipt
    if (member.userId !== cli.getUserId()) {
        const onIgnoreToggle = () => {
            const ignoredUsers = cli.getIgnoredUsers();
            if (isIgnored) {
                const index = ignoredUsers.indexOf(member.userId);
                if (index !== -1) ignoredUsers.splice(index, 1);
            } else {
                ignoredUsers.push(member.userId);
            }

            cli.setIgnoredUsers(ignoredUsers);
        };

        ignoreButton = (
            <AccessibleButton onClick={onIgnoreToggle} className="mx_UserInfo_field">
                { isIgnored ? _t("Unignore") : _t("Ignore") }
            </AccessibleButton>
        );

        if (member.roomId) {
            const onReadReceiptButton = function() {
                const room = cli.getRoom(member.roomId);
                dis.dispatch({
                    action: 'view_room',
                    highlighted: true,
                    event_id: room.getEventReadUpTo(member.userId),
                    room_id: member.roomId,
                });
            };

            const onInsertPillButton = function() {
                dis.dispatch({
                    action: 'insert_mention',
                    user_id: member.userId,
                });
            };

            readReceiptButton = (
                <AccessibleButton onClick={onReadReceiptButton} className="mx_UserInfo_field">
                    { _t('Jump to read receipt') }
                </AccessibleButton>
            );

            insertPillButton = (
                <AccessibleButton onClick={onInsertPillButton} className={"mx_UserInfo_field"}>
                    { _t('Mention') }
                </AccessibleButton>
            );
        }

        if (canInvite && (!member || !member.membership || member.membership === 'leave')) {
            const roomId = member && member.roomId ? member.roomId : RoomViewStore.getRoomId();
            const onInviteUserButton = async () => {
                try {
                    // We use a MultiInviter to re-use the invite logic, even though
                    // we're only inviting one user.
                    const inviter = new MultiInviter(roomId);
                    await inviter.invite([member.userId]).then(() => {
                        if (inviter.getCompletionState(member.userId) !== "invited") {
                            throw new Error(inviter.getErrorText(member.userId));
                        }
                    });
                } catch (err) {
                    const ErrorDialog = sdk.getComponent('dialogs.ErrorDialog');
                    Modal.createTrackedDialog('Failed to invite', '', ErrorDialog, {
                        title: _t('Failed to invite'),
                        description: ((err && err.message) ? err.message : _t("Operation failed")),
                    });
                }
            };

            inviteUserButton = (
                <AccessibleButton onClick={onInviteUserButton} className="mx_UserInfo_field">
                    { _t('Invite') }
                </AccessibleButton>
            );
        }
    }

    const shareUserButton = (
        <AccessibleButton onClick={onShareUserClick} className="mx_UserInfo_field">
            { _t('Share Link to User') }
        </AccessibleButton>
    );

    let directMessageButton;
    if (!isMe) {
        directMessageButton = (
            <AccessibleButton onClick={() => openDMForUser(cli, member.userId)} className="mx_UserInfo_field">
                { _t('Direct message') }
            </AccessibleButton>
        );
    }

    return (
        <div className="mx_UserInfo_container">
            <h3>{ _t("User Options") }</h3>
            <div className="mx_UserInfo_buttons">
                { directMessageButton }
                { readReceiptButton }
                { shareUserButton }
                { insertPillButton }
                { ignoreButton }
                { inviteUserButton }
            </div>
        </div>
    );
});

const _warnSelfDemote = async () => {
    const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
    const {finished} = Modal.createTrackedDialog('Demoting Self', '', QuestionDialog, {
        title: _t("Demote yourself?"),
        description:
            <div>
                { _t("You will not be able to undo this change as you are demoting yourself, " +
                    "if you are the last privileged user in the room it will be impossible " +
                    "to regain privileges.") }
            </div>,
        button: _t("Demote"),
    });

    const [confirmed] = await finished;
    return confirmed;
};

const GenericAdminToolsContainer = ({children}) => {
    return (
        <div className="mx_UserInfo_container">
            <h3>{ _t("Admin Tools") }</h3>
            <div className="mx_UserInfo_buttons">
                { children }
            </div>
        </div>
    );
};

const _isMuted = (member, powerLevelContent) => {
    if (!powerLevelContent || !member) return false;

    const levelToSend = (
        (powerLevelContent.events ? powerLevelContent.events["m.room.message"] : null) ||
        powerLevelContent.events_default
    );
    return member.powerLevel < levelToSend;
};

const useRoomPowerLevels = (room) => {
    const [powerLevels, setPowerLevels] = useState({});

    const update = useCallback(() => {
        const event = room.currentState.getStateEvents("m.room.power_levels", "");
        if (event) {
            setPowerLevels(event.getContent());
        } else {
            setPowerLevels({});
        }
        return () => {
            setPowerLevels({});
        };
    }, [room]);

    useEventEmitter(room, "RoomState.events", update);
    useEffect(() => {
        update();
        return () => {
            setPowerLevels({});
        };
    }, [update]);
    return powerLevels;
};

const RoomKickButton = withLegacyMatrixClient(({matrixClient: cli, member, startUpdating, stopUpdating}) => {
    const onKick = async () => {
        const ConfirmUserActionDialog = sdk.getComponent("dialogs.ConfirmUserActionDialog");
        const {finished} = Modal.createTrackedDialog(
            'Confirm User Action Dialog',
            'onKick',
            ConfirmUserActionDialog,
            {
                member,
                action: member.membership === "invite" ? _t("Disinvite") : _t("Kick"),
                title: member.membership === "invite" ? _t("Disinvite this user?") : _t("Kick this user?"),
                askReason: member.membership === "join",
                danger: true,
            },
        );

        const [proceed, reason] = await finished;
        if (!proceed) return;

        startUpdating();
        cli.kick(member.roomId, member.userId, reason || undefined).then(() => {
            // NO-OP; rely on the m.room.member event coming down else we could
            // get out of sync if we force setState here!
            console.log("Kick success");
        }, function(err) {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            console.error("Kick error: " + err);
            Modal.createTrackedDialog('Failed to kick', '', ErrorDialog, {
                title: _t("Failed to kick"),
                description: ((err && err.message) ? err.message : "Operation failed"),
            });
        }).finally(() => {
            stopUpdating();
        });
    };

    const kickLabel = member.membership === "invite" ? _t("Disinvite") : _t("Kick");
    return <AccessibleButton className="mx_UserInfo_field" onClick={onKick}>
        { kickLabel }
    </AccessibleButton>;
});

const RedactMessagesButton = withLegacyMatrixClient(({matrixClient: cli, member}) => {
    const onRedactAllMessages = async () => {
        const {roomId, userId} = member;
        const room = cli.getRoom(roomId);
        if (!room) {
            return;
        }
        let timeline = room.getLiveTimeline();
        let eventsToRedact = [];
        while (timeline) {
            eventsToRedact = timeline.getEvents().reduce((events, event) => {
                if (event.getSender() === userId && !event.isRedacted()) {
                    return events.concat(event);
                } else {
                    return events;
                }
            }, eventsToRedact);
            timeline = timeline.getNeighbouringTimeline(EventTimeline.BACKWARDS);
        }

        const count = eventsToRedact.length;
        const user = member.name;

        if (count === 0) {
            const InfoDialog = sdk.getComponent("dialogs.InfoDialog");
            Modal.createTrackedDialog('No user messages found to remove', '', InfoDialog, {
                title: _t("No recent messages by %(user)s found", {user}),
                description:
                    <div>
                        <p>{ _t("Try scrolling up in the timeline to see if there are any earlier ones.") }</p>
                    </div>,
            });
        } else {
            const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");

            const {finished} = Modal.createTrackedDialog('Remove recent messages by user', '', QuestionDialog, {
                title: _t("Remove recent messages by %(user)s", {user}),
                description:
                    <div>
                        <p>{ _t("You are about to remove %(count)s messages by %(user)s. This cannot be undone. Do you wish to continue?", {count, user}) }</p>
                        <p>{ _t("For a large amount of messages, this might take some time. Please don't refresh your client in the meantime.") }</p>
                    </div>,
                button: _t("Remove %(count)s messages", {count}),
            });

            const [confirmed] = await finished;
            if (!confirmed) {
                return;
            }

            // Submitting a large number of redactions freezes the UI,
            // so first yield to allow to rerender after closing the dialog.
            await Promise.resolve();

            console.info(`Started redacting recent ${count} messages for ${user} in ${roomId}`);
            await Promise.all(eventsToRedact.map(async event => {
                try {
                    await cli.redactEvent(roomId, event.getId());
                } catch (err) {
                    // log and swallow errors
                    console.error("Could not redact", event.getId());
                    console.error(err);
                }
            }));
            console.info(`Finished redacting recent ${count} messages for ${user} in ${roomId}`);
        }
    };

    return <AccessibleButton className="mx_UserInfo_field" onClick={onRedactAllMessages}>
        { _t("Remove recent messages") }
    </AccessibleButton>;
});

const BanToggleButton = withLegacyMatrixClient(({matrixClient: cli, member, startUpdating, stopUpdating}) => {
    const onBanOrUnban = async () => {
        const ConfirmUserActionDialog = sdk.getComponent("dialogs.ConfirmUserActionDialog");
        const {finished} = Modal.createTrackedDialog(
            'Confirm User Action Dialog',
            'onBanOrUnban',
            ConfirmUserActionDialog,
            {
                member,
                action: member.membership === 'ban' ? _t("Unban") : _t("Ban"),
                title: member.membership === 'ban' ? _t("Unban this user?") : _t("Ban this user?"),
                askReason: member.membership !== 'ban',
                danger: member.membership !== 'ban',
            },
        );

        const [proceed, reason] = await finished;
        if (!proceed) return;

        startUpdating();
        let promise;
        if (member.membership === 'ban') {
            promise = cli.unban(member.roomId, member.userId);
        } else {
            promise = cli.ban(member.roomId, member.userId, reason || undefined);
        }
        promise.then(() => {
            // NO-OP; rely on the m.room.member event coming down else we could
            // get out of sync if we force setState here!
            console.log("Ban success");
        }, function(err) {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            console.error("Ban error: " + err);
            Modal.createTrackedDialog('Failed to ban user', '', ErrorDialog, {
                title: _t("Error"),
                description: _t("Failed to ban user"),
            });
        }).finally(() => {
            stopUpdating();
        });
    };

    let label = _t("Ban");
    if (member.membership === 'ban') {
        label = _t("Unban");
    }

    return <AccessibleButton className="mx_UserInfo_field" onClick={onBanOrUnban}>
        { label }
    </AccessibleButton>;
});

const MuteToggleButton = withLegacyMatrixClient(
    ({matrixClient: cli, member, room, powerLevels, startUpdating, stopUpdating}) => {
        const isMuted = _isMuted(member, powerLevels);
        const onMuteToggle = async () => {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            const roomId = member.roomId;
            const target = member.userId;

            // if muting self, warn as it may be irreversible
            if (target === cli.getUserId()) {
                try {
                    if (!(await _warnSelfDemote())) return;
                } catch (e) {
                    console.error("Failed to warn about self demotion: ", e);
                    return;
                }
            }

            const powerLevelEvent = room.currentState.getStateEvents("m.room.power_levels", "");
            if (!powerLevelEvent) return;

            const powerLevels = powerLevelEvent.getContent();
            const levelToSend = (
                (powerLevels.events ? powerLevels.events["m.room.message"] : null) ||
                powerLevels.events_default
            );
            let level;
            if (isMuted) { // unmute
                level = levelToSend;
            } else { // mute
                level = levelToSend - 1;
            }
            level = parseInt(level);

            if (!isNaN(level)) {
                startUpdating();
                cli.setPowerLevel(roomId, target, level, powerLevelEvent).then(() => {
                    // NO-OP; rely on the m.room.member event coming down else we could
                    // get out of sync if we force setState here!
                    console.log("Mute toggle success");
                }, function(err) {
                    console.error("Mute error: " + err);
                    Modal.createTrackedDialog('Failed to mute user', '', ErrorDialog, {
                        title: _t("Error"),
                        description: _t("Failed to mute user"),
                    });
                }).finally(() => {
                    stopUpdating();
                });
            }
        };

        const muteLabel = isMuted ? _t("Unmute") : _t("Mute");
        return <AccessibleButton className="mx_UserInfo_field" onClick={onMuteToggle}>
            { muteLabel }
        </AccessibleButton>;
    },
);

const RoomAdminToolsContainer = withLegacyMatrixClient(
    ({matrixClient: cli, room, children, member, startUpdating, stopUpdating}) => {
        let kickButton;
        let banButton;
        let muteButton;
        let redactButton;

        const powerLevels = useRoomPowerLevels(room);
        const editPowerLevel = (
            (powerLevels.events ? powerLevels.events["m.room.power_levels"] : null) ||
            powerLevels.state_default
        );

        const me = room.getMember(cli.getUserId());
        const isMe = me.userId === member.userId;
        const canAffectUser = member.powerLevel < me.powerLevel || isMe;

        if (canAffectUser && me.powerLevel >= powerLevels.kick) {
            kickButton = <RoomKickButton member={member} startUpdating={startUpdating} stopUpdating={stopUpdating} />;
        }
        if (me.powerLevel >= powerLevels.redact) {
            redactButton = (
                <RedactMessagesButton member={member} startUpdating={startUpdating} stopUpdating={stopUpdating} />
            );
        }
        if (canAffectUser && me.powerLevel >= powerLevels.ban) {
            banButton = <BanToggleButton member={member} startUpdating={startUpdating} stopUpdating={stopUpdating} />;
        }
        if (canAffectUser && me.powerLevel >= editPowerLevel) {
            muteButton = (
                <MuteToggleButton
                    member={member}
                    room={room}
                    powerLevels={powerLevels}
                    startUpdating={startUpdating}
                    stopUpdating={stopUpdating}
                />
            );
        }

        if (kickButton || banButton || muteButton || redactButton || children) {
            return <GenericAdminToolsContainer>
                { muteButton }
                { kickButton }
                { banButton }
                { redactButton }
                { children }
            </GenericAdminToolsContainer>;
        }

        return <div />;
    },
);

const GroupAdminToolsSection = withLegacyMatrixClient(
    ({matrixClient: cli, children, groupId, groupMember, startUpdating, stopUpdating}) => {
        const [isPrivileged, setIsPrivileged] = useState(false);
        const [isInvited, setIsInvited] = useState(false);

        // Listen to group store changes
        useEffect(() => {
            let unmounted = false;

            const onGroupStoreUpdated = () => {
                if (unmounted) return;
                setIsPrivileged(GroupStore.isUserPrivileged(groupId));
                setIsInvited(GroupStore.getGroupInvitedMembers(groupId).some(
                    (m) => m.userId === groupMember.userId,
                ));
            };

            GroupStore.registerListener(groupId, onGroupStoreUpdated);
            onGroupStoreUpdated();
            // Handle unmount
            return () => {
                unmounted = true;
                GroupStore.unregisterListener(onGroupStoreUpdated);
            };
        }, [groupId, groupMember.userId]);

        if (isPrivileged) {
            const _onKick = async () => {
                const ConfirmUserActionDialog = sdk.getComponent("dialogs.ConfirmUserActionDialog");
                const {finished} = Modal.createDialog(ConfirmUserActionDialog, {
                    matrixClient: cli,
                    groupMember,
                    action: isInvited ? _t('Disinvite') : _t('Remove from community'),
                    title: isInvited ? _t('Disinvite this user from community?')
                        : _t('Remove this user from community?'),
                    danger: true,
                });

                const [proceed] = await finished;
                if (!proceed) return;

                startUpdating();
                cli.removeUserFromGroup(groupId, groupMember.userId).then(() => {
                    // return to the user list
                    dis.dispatch({
                        action: "view_user",
                        member: null,
                    });
                }).catch((e) => {
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createTrackedDialog('Failed to remove user from group', '', ErrorDialog, {
                        title: _t('Error'),
                        description: isInvited ?
                            _t('Failed to withdraw invitation') :
                            _t('Failed to remove user from community'),
                    });
                    console.log(e);
                }).finally(() => {
                    stopUpdating();
                });
            };

            const kickButton = (
                <AccessibleButton className="mx_UserInfo_field" onClick={_onKick}>
                    { isInvited ? _t('Disinvite') : _t('Remove from community') }
                </AccessibleButton>
            );

            // No make/revoke admin API yet
            /*const opLabel = this.state.isTargetMod ? _t("Revoke Moderator") : _t("Make Moderator");
            giveModButton = <AccessibleButton className="mx_UserInfo_field" onClick={this.onModToggle}>
                {giveOpLabel}
            </AccessibleButton>;*/

            return <GenericAdminToolsContainer>
                { kickButton }
                { children }
            </GenericAdminToolsContainer>;
        }

        return <div />;
    },
);

const GroupMember = PropTypes.shape({
    userId: PropTypes.string.isRequired,
    displayname: PropTypes.string, // XXX: GroupMember objects are inconsistent :((
    avatarUrl: PropTypes.string,
});

const useIsSynapseAdmin = (cli) => {
    const [isAdmin, setIsAdmin] = useState(false);
    useEffect(() => {
        cli.isSynapseAdministrator().then((isAdmin) => {
            setIsAdmin(isAdmin);
        }, () => {
            setIsAdmin(false);
        });
    }, [cli]);
    return isAdmin;
};

// cli is injected by withLegacyMatrixClient
const UserInfo = withLegacyMatrixClient(({matrixClient: cli, user, groupId, roomId, onClose}) => {
    // Load room if we are given a room id and memoize it
    const room = useMemo(() => roomId ? cli.getRoom(roomId) : null, [cli, roomId]);

    // only display the devices list if our client supports E2E
    const _enableDevices = cli.isCryptoEnabled();

    // Load whether or not we are a Synapse Admin
    const isSynapseAdmin = useIsSynapseAdmin(cli);

    // Check whether the user is ignored
    const [isIgnored, setIsIgnored] = useState(cli.isUserIgnored(user.userId));
    // Recheck if the user or client changes
    useEffect(() => {
        setIsIgnored(cli.isUserIgnored(user.userId));
    }, [cli, user.userId]);
    // Recheck also if we receive new accountData m.ignored_user_list
    const accountDataHandler = useCallback((ev) => {
        if (ev.getType() === "m.ignored_user_list") {
            setIsIgnored(cli.isUserIgnored(user.userId));
        }
    }, [cli, user.userId]);
    useEventEmitter(cli, "accountData", accountDataHandler);

    // Count of how many operations are currently in progress, if > 0 then show a Spinner
    const [pendingUpdateCount, setPendingUpdateCount] = useState(0);
    const startUpdating = useCallback(() => {
        setPendingUpdateCount(pendingUpdateCount + 1);
    }, [pendingUpdateCount]);
    const stopUpdating = useCallback(() => {
        setPendingUpdateCount(pendingUpdateCount - 1);
    }, [pendingUpdateCount]);

    const [roomPermissions, setRoomPermissions] = useState({
        // modifyLevelMax is the max PL we can set this user to, typically min(their PL, our PL) && canSetPL
        modifyLevelMax: -1,
        canInvite: false,
    });
    const updateRoomPermissions = useCallback(async () => {
        if (!room) return;

        const powerLevelEvent = room.currentState.getStateEvents("m.room.power_levels", "");
        if (!powerLevelEvent) return;
        const powerLevels = powerLevelEvent.getContent();
        if (!powerLevels) return;

        const me = room.getMember(cli.getUserId());
        if (!me) return;

        const them = user;
        const isMe = me.userId === them.userId;
        const canAffectUser = them.powerLevel < me.powerLevel || isMe;

        let modifyLevelMax = -1;
        if (canAffectUser) {
            const editPowerLevel = (
                (powerLevels.events ? powerLevels.events["m.room.power_levels"] : null) ||
                powerLevels.state_default
            );
            if (me.powerLevel >= editPowerLevel && (isMe || me.powerLevel > them.powerLevel)) {
                modifyLevelMax = me.powerLevel;
            }
        }

        setRoomPermissions({
            canInvite: me.powerLevel >= powerLevels.invite,
            modifyLevelMax,
        });
    }, [cli, user, room]);
    useEventEmitter(cli, "RoomState.events", updateRoomPermissions);
    useEffect(() => {
        updateRoomPermissions();
        return () => {
            setRoomPermissions({
                maximalPowerLevel: -1,
                canInvite: false,
            });
        };
    }, [updateRoomPermissions]);

    const onSynapseDeactivate = useCallback(async () => {
        const QuestionDialog = sdk.getComponent('views.dialogs.QuestionDialog');
        const {finished} = Modal.createTrackedDialog('Synapse User Deactivation', '', QuestionDialog, {
            title: _t("Deactivate user?"),
            description:
                <div>{ _t(
                    "Deactivating this user will log them out and prevent them from logging back in. Additionally, " +
                    "they will leave all the rooms they are in. This action cannot be reversed. Are you sure you " +
                    "want to deactivate this user?",
                ) }</div>,
            button: _t("Deactivate user"),
            danger: true,
        });

        const [accepted] = await finished;
        if (!accepted) return;
        try {
            cli.deactivateSynapseUser(user.userId);
        } catch (err) {
            const ErrorDialog = sdk.getComponent('dialogs.ErrorDialog');
            Modal.createTrackedDialog('Failed to deactivate user', '', ErrorDialog, {
                title: _t('Failed to deactivate user'),
                description: ((err && err.message) ? err.message : _t("Operation failed")),
            });
        }
    }, [cli, user.userId]);

    const onPowerChange = useCallback(async (powerLevel) => {
        const _applyPowerChange = (roomId, target, powerLevel, powerLevelEvent) => {
            startUpdating();
            cli.setPowerLevel(roomId, target, parseInt(powerLevel), powerLevelEvent).then(
                function() {
                    // NO-OP; rely on the m.room.member event coming down else we could
                    // get out of sync if we force setState here!
                    console.log("Power change success");
                }, function(err) {
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    console.error("Failed to change power level " + err);
                    Modal.createTrackedDialog('Failed to change power level', '', ErrorDialog, {
                        title: _t("Error"),
                        description: _t("Failed to change power level"),
                    });
                },
            ).finally(() => {
                stopUpdating();
            }).done();
        };

        const roomId = user.roomId;
        const target = user.userId;

        const powerLevelEvent = room.currentState.getStateEvents("m.room.power_levels", "");
        if (!powerLevelEvent) return;

        if (!powerLevelEvent.getContent().users) {
            _applyPowerChange(roomId, target, powerLevel, powerLevelEvent);
            return;
        }

        const myUserId = cli.getUserId();
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");

        // If we are changing our own PL it can only ever be decreasing, which we cannot reverse.
        if (myUserId === target) {
            try {
                if (!(await _warnSelfDemote())) return;
                _applyPowerChange(roomId, target, powerLevel, powerLevelEvent);
            } catch (e) {
                console.error("Failed to warn about self demotion: ", e);
            }
            return;
        }

        const myPower = powerLevelEvent.getContent().users[myUserId];
        if (parseInt(myPower) === parseInt(powerLevel)) {
            const {finished} = Modal.createTrackedDialog('Promote to PL100 Warning', '', QuestionDialog, {
                title: _t("Warning!"),
                description:
                    <div>
                        { _t("You will not be able to undo this change as you are promoting the user " +
                            "to have the same power level as yourself.") }<br />
                        { _t("Are you sure?") }
                    </div>,
                button: _t("Continue"),
            });

            const [confirmed] = await finished;
            if (confirmed) return;
        }
        _applyPowerChange(roomId, target, powerLevel, powerLevelEvent);
    }, [user.roomId, user.userId, room && room.currentState, cli]); // eslint-disable-line

    const onMemberAvatarKey = e => {
        if (e.key === "Enter") {
            onMemberAvatarClick();
        }
    };

    const onMemberAvatarClick = useCallback(() => {
        const member = user;
        const avatarUrl = member.getMxcAvatarUrl();
        if (!avatarUrl) return;

        const httpUrl = cli.mxcUrlToHttp(avatarUrl);
        const ImageView = sdk.getComponent("elements.ImageView");
        const params = {
            src: httpUrl,
            name: member.name,
        };

        Modal.createDialog(ImageView, params, "mx_Dialog_lightbox");
    }, [cli, user]);

    let synapseDeactivateButton;
    let spinner;

    let directChatsSection;
    if (user.userId !== cli.getUserId()) {
        directChatsSection = <DirectChatsSection userId={user.userId} />;
    }

    // We don't need a perfect check here, just something to pass as "probably not our homeserver". If
    // someone does figure out how to bypass this check the worst that happens is an error.
    // FIXME this should be using cli instead of MatrixClientPeg.matrixClient
    if (isSynapseAdmin && user.userId.endsWith(`:${MatrixClientPeg.getHomeserverName()}`)) {
        synapseDeactivateButton = (
            <AccessibleButton onClick={onSynapseDeactivate} className="mx_UserInfo_field">
                {_t("Deactivate user")}
            </AccessibleButton>
        );
    }

    let adminToolsContainer;
    if (room && user.roomId) {
        adminToolsContainer = (
            <RoomAdminToolsContainer
                member={user}
                room={room}
                startUpdating={startUpdating}
                stopUpdating={stopUpdating}>
                { synapseDeactivateButton }
            </RoomAdminToolsContainer>
        );
    } else if (groupId) {
        adminToolsContainer = (
            <GroupAdminToolsSection
                groupId={groupId}
                groupMember={user}
                startUpdating={startUpdating}
                stopUpdating={stopUpdating}>
                { synapseDeactivateButton }
            </GroupAdminToolsSection>
        );
    } else if (synapseDeactivateButton) {
        adminToolsContainer = (
            <GenericAdminToolsContainer>
                { synapseDeactivateButton }
            </GenericAdminToolsContainer>
        );
    }

    if (pendingUpdateCount > 0) {
        const Loader = sdk.getComponent("elements.Spinner");
        spinner = <Loader imgClassName="mx_ContextualMenu_spinner" />;
    }

    const displayName = user.name || user.displayname;

    let presenceState;
    let presenceLastActiveAgo;
    let presenceCurrentlyActive;
    let statusMessage;

    if (user instanceof RoomMember) {
        presenceState = user.user.presence;
        presenceLastActiveAgo = user.user.lastActiveAgo;
        presenceCurrentlyActive = user.user.currentlyActive;

        if (SettingsStore.isFeatureEnabled("feature_custom_status")) {
            statusMessage = user.user._unstable_statusMessage;
        }
    }

    const enablePresenceByHsUrl = SdkConfig.get()["enable_presence_by_hs_url"];
    let showPresence = true;
    if (enablePresenceByHsUrl && enablePresenceByHsUrl[cli.baseUrl] !== undefined) {
        showPresence = enablePresenceByHsUrl[cli.baseUrl];
    }

    let presenceLabel = null;
    if (showPresence) {
        const PresenceLabel = sdk.getComponent('rooms.PresenceLabel');
        presenceLabel = <PresenceLabel activeAgo={presenceLastActiveAgo}
                                       currentlyActive={presenceCurrentlyActive}
                                       presenceState={presenceState} />;
    }

    let statusLabel = null;
    if (statusMessage) {
        statusLabel = <span className="mx_UserInfo_statusMessage">{ statusMessage }</span>;
    }

    let memberDetails = null;

    if (room && user.roomId) { // is in room
        const powerLevelEvent = room.currentState.getStateEvents("m.room.power_levels", "");
        const powerLevelUsersDefault = powerLevelEvent ? powerLevelEvent.getContent().users_default : 0;

        const PowerSelector = sdk.getComponent('elements.PowerSelector');
        memberDetails = <div>
            <div className="mx_UserInfo_profileField">
                <PowerSelector
                    value={parseInt(user.powerLevel)}
                    maxValue={roomPermissions.modifyLevelMax}
                    disabled={roomPermissions.modifyLevelMax < 0}
                    usersDefault={powerLevelUsersDefault}
                    onChange={onPowerChange} />
            </div>

        </div>;
    }

    const avatarUrl = user.getMxcAvatarUrl ? user.getMxcAvatarUrl() : user.avatarUrl;
    let avatarElement;
    if (avatarUrl) {
        const httpUrl = cli.mxcUrlToHttp(avatarUrl, 800, 800);
        avatarElement = <div
            className="mx_UserInfo_avatar"
            onClick={onMemberAvatarClick}
            onKeyDown={onMemberAvatarKey}
            tabIndex="0"
            role="img"
            aria-label={_t("Profile picture")}
        >
            <div><div style={{backgroundImage: `url(${httpUrl})`}} /></div>
        </div>;
    }

    let closeButton;
    if (onClose) {
        closeButton = <AccessibleButton
            className="mx_UserInfo_cancel"
            onClick={onClose}
            title={_t('Close')} />;
    }

    // undefined means yet to be loaded, null means failed to load, otherwise list of devices
    const [devices, setDevices] = useState(undefined);
    // Download device lists
    useEffect(() => {
        setDevices(undefined);

        let cancelled = false;

        async function _downloadDeviceList() {
            try {
                await cli.downloadKeys([user.userId], true);
                const devices = await cli.getStoredDevicesForUser(user.userId);

                if (cancelled) {
                    // we got cancelled - presumably a different user now
                    return;
                }

                _disambiguateDevices(devices);
                setDevices(devices);
            } catch (err) {
                setDevices(null);
            }
        }

        _downloadDeviceList();

        // Handle being unmounted
        return () => {
            cancelled = true;
        };
    }, [cli, user.userId]);

    // Listen to changes
    useEffect(() => {
        let cancel = false;
        const onDeviceVerificationChanged = (_userId, device) => {
            if (_userId === user.userId) {
                // no need to re-download the whole thing; just update our copy of the list.

                // Promise.resolve to handle transition from static result to promise; can be removed in future
                Promise.resolve(cli.getStoredDevicesForUser(user.userId)).then((devices) => {
                    if (cancel) return;
                    setDevices(devices);
                });
            }
        };

        cli.on("deviceVerificationChanged", onDeviceVerificationChanged);
        // Handle being unmounted
        return () => {
            cancel = true;
            cli.removeListener("deviceVerificationChanged", onDeviceVerificationChanged);
        };
    }, [cli, user.userId]);

    let devicesSection;
    const isRoomEncrypted = _enableDevices && room && cli.isRoomEncrypted(room.roomId);
    if (isRoomEncrypted) {
        devicesSection = <DevicesSection loading={devices === undefined} devices={devices} userId={user.userId} />;
    } else {
        let text;

        if (!_enableDevices) {
            text = _t("This client does not support end-to-end encryption.");
        } else if (room) {
            text = _t("Messages in this room are not end-to-end encrypted.");
        } else {
            // TODO what to render for GroupMember
        }

        if (text) {
            devicesSection = (
                <div className="mx_UserInfo_container">
                    <h3>{ _t("Trust & Devices") }</h3>
                    <div className="mx_UserInfo_devices">
                        { text }
                    </div>
                </div>
            );
        }
    }

    let e2eIcon;
    if (isRoomEncrypted && devices) {
        e2eIcon = <E2EIcon size={18} status={_getE2EStatus(devices)} isUser={true} />;
    }

    return (
        <div className="mx_UserInfo" role="tabpanel">
            { closeButton }
            { avatarElement }

            <div className="mx_UserInfo_container">
                <div className="mx_UserInfo_profile">
                    <div >
                        <h2 aria-label={displayName}>
                            { e2eIcon }
                            { displayName }
                        </h2>
                    </div>
                    <div>{ user.userId }</div>
                    <div className="mx_UserInfo_profileStatus">
                        {presenceLabel}
                        {statusLabel}
                    </div>
                </div>
            </div>

            { memberDetails && <div className="mx_UserInfo_container mx_UserInfo_memberDetailsContainer">
                <div className="mx_UserInfo_memberDetails">
                    { memberDetails }
                </div>
            </div> }

            <AutoHideScrollbar className="mx_UserInfo_scrollContainer">
                { devicesSection }

                { directChatsSection }

                <UserOptionsSection
                    canInvite={roomPermissions.canInvite}
                    isIgnored={isIgnored}
                    member={user} />

                { adminToolsContainer }

                { spinner }
            </AutoHideScrollbar>
        </div>
    );
});

UserInfo.propTypes = {
    user: PropTypes.oneOfType([
        PropTypes.instanceOf(User),
        PropTypes.instanceOf(RoomMember),
        GroupMember,
    ]).isRequired,
    group: PropTypes.instanceOf(Group),
    groupId: PropTypes.string,
    roomId: PropTypes.string,

    onClose: PropTypes.func,
};

export default UserInfo;

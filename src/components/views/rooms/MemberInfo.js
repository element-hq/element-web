/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 Vector Creations Ltd

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

/*
 * State vars:
 * 'can': {
 *   kick: boolean,
 *   ban: boolean,
 *   mute: boolean,
 *   modifyLevel: boolean
 * },
 * 'muted': boolean,
 * 'isTargetMod': boolean
 */
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import dis from '../../../dispatcher';
import Modal from '../../../Modal';
import sdk from '../../../index';
import { _t } from '../../../languageHandler';
import createRoom from '../../../createRoom';
import DMRoomMap from '../../../utils/DMRoomMap';
import Unread from '../../../Unread';
import { findReadReceiptFromUserId } from '../../../utils/Receipt';
import withMatrixClient from '../../../wrappers/withMatrixClient';
import AccessibleButton from '../elements/AccessibleButton';
import RoomViewStore from '../../../stores/RoomViewStore';
import SdkConfig from '../../../SdkConfig';

module.exports = withMatrixClient(React.createClass({
    displayName: 'MemberInfo',

    propTypes: {
        matrixClient: PropTypes.object.isRequired,
        member: PropTypes.object.isRequired,
    },

    getInitialState: function() {
        return {
            can: {
                kick: false,
                ban: false,
                mute: false,
                modifyLevel: false,
            },
            muted: false,
            isTargetMod: false,
            updating: 0,
            devicesLoading: true,
            devices: null,
            isIgnoring: false,
        };
    },

    componentWillMount: function() {
        this._cancelDeviceList = null;

        // only display the devices list if our client supports E2E
        this._enableDevices = this.props.matrixClient.isCryptoEnabled();

        const cli = this.props.matrixClient;
        cli.on("deviceVerificationChanged", this.onDeviceVerificationChanged);
        cli.on("Room", this.onRoom);
        cli.on("deleteRoom", this.onDeleteRoom);
        cli.on("Room.timeline", this.onRoomTimeline);
        cli.on("Room.name", this.onRoomName);
        cli.on("Room.receipt", this.onRoomReceipt);
        cli.on("RoomState.events", this.onRoomStateEvents);
        cli.on("RoomMember.name", this.onRoomMemberName);
        cli.on("RoomMember.membership", this.onRoomMemberMembership);
        cli.on("accountData", this.onAccountData);

        this._checkIgnoreState();
    },

    componentDidMount: function() {
        this._updateStateForNewMember(this.props.member);
    },

    componentWillReceiveProps: function(newProps) {
        if (this.props.member.userId !== newProps.member.userId) {
            this._updateStateForNewMember(newProps.member);
        }
    },

    componentWillUnmount: function() {
        const client = this.props.matrixClient;
        if (client) {
            client.removeListener("deviceVerificationChanged", this.onDeviceVerificationChanged);
            client.removeListener("Room", this.onRoom);
            client.removeListener("deleteRoom", this.onDeleteRoom);
            client.removeListener("Room.timeline", this.onRoomTimeline);
            client.removeListener("Room.name", this.onRoomName);
            client.removeListener("Room.receipt", this.onRoomReceipt);
            client.removeListener("RoomState.events", this.onRoomStateEvents);
            client.removeListener("RoomMember.name", this.onRoomMemberName);
            client.removeListener("RoomMember.membership", this.onRoomMemberMembership);
            client.removeListener("accountData", this.onAccountData);
        }
        if (this._cancelDeviceList) {
            this._cancelDeviceList();
        }
    },

    _checkIgnoreState: function() {
        const isIgnoring = this.props.matrixClient.isUserIgnored(this.props.member.userId);
        this.setState({isIgnoring: isIgnoring});
    },

    _disambiguateDevices: function(devices) {
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
    },

    onDeviceVerificationChanged: function(userId, device) {
        if (!this._enableDevices) {
            return;
        }

        if (userId === this.props.member.userId) {
            // no need to re-download the whole thing; just update our copy of
            // the list.

            // Promise.resolve to handle transition from static result to promise; can be removed
            // in future
            Promise.resolve(this.props.matrixClient.getStoredDevicesForUser(userId)).then((devices) => {
                this.setState({devices: devices});
            });
        }
    },

    onRoom: function(room) {
        this.forceUpdate();
    },

    onDeleteRoom: function(roomId) {
        this.forceUpdate();
    },

    onRoomTimeline: function(ev, room, toStartOfTimeline) {
        if (toStartOfTimeline) return;
        this.forceUpdate();
    },

    onRoomName: function(room) {
        this.forceUpdate();
    },

    onRoomReceipt: function(receiptEvent, room) {
        // because if we read a notification, it will affect notification count
        // only bother updating if there's a receipt from us
        if (findReadReceiptFromUserId(receiptEvent, this.props.matrixClient.credentials.userId)) {
            this.forceUpdate();
        }
    },

    onRoomStateEvents: function(ev, state) {
        this.forceUpdate();
    },

    onRoomMemberName: function(ev, member) {
        this.forceUpdate();
    },

    onRoomMemberMembership: function(ev, member) {
        if (this.props.member.userId === member.userId) this.forceUpdate();
    },

    onAccountData: function(ev) {
        if (ev.getType() === 'm.direct') {
            this.forceUpdate();
        }
    },

    _updateStateForNewMember: function(member) {
        const newState = this._calculateOpsPermissions(member);
        newState.devicesLoading = true;
        newState.devices = null;
        this.setState(newState);

        if (this._cancelDeviceList) {
            this._cancelDeviceList();
            this._cancelDeviceList = null;
        }

        this._downloadDeviceList(member);
    },

    _downloadDeviceList: function(member) {
        if (!this._enableDevices) {
            return;
        }

        let cancelled = false;
        this._cancelDeviceList = function() { cancelled = true; };

        const client = this.props.matrixClient;
        const self = this;
        client.downloadKeys([member.userId], true).then(() => {
            return client.getStoredDevicesForUser(member.userId);
        }).finally(function() {
            self._cancelDeviceList = null;
        }).done(function(devices) {
            if (cancelled) {
                // we got cancelled - presumably a different user now
                return;
            }
            self._disambiguateDevices(devices);
            self.setState({devicesLoading: false, devices: devices});
        }, function(err) {
            console.log("Error downloading devices", err);
            self.setState({devicesLoading: false});
        });
    },

    onIgnoreToggle: function() {
        const ignoredUsers = this.props.matrixClient.getIgnoredUsers();
        if (this.state.isIgnoring) {
            const index = ignoredUsers.indexOf(this.props.member.userId);
            if (index !== -1) ignoredUsers.splice(index, 1);
        } else {
            ignoredUsers.push(this.props.member.userId);
        }

        this.props.matrixClient.setIgnoredUsers(ignoredUsers).then(() => {
            return this.setState({isIgnoring: !this.state.isIgnoring});
        });
    },

    onKick: function() {
        const membership = this.props.member.membership;
        const ConfirmUserActionDialog = sdk.getComponent("dialogs.ConfirmUserActionDialog");
        Modal.createTrackedDialog('Confirm User Action Dialog', 'onKick', ConfirmUserActionDialog, {
            member: this.props.member,
            action: membership === "invite" ? _t("Disinvite") : _t("Kick"),
            title: membership === "invite" ? _t("Disinvite this user?") : _t("Kick this user?"),
            askReason: membership === "join",
            danger: true,
            onFinished: (proceed, reason) => {
                if (!proceed) return;

                this.setState({ updating: this.state.updating + 1 });
                this.props.matrixClient.kick(
                    this.props.member.roomId, this.props.member.userId,
                    reason || undefined,
                ).then(function() {
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
                    },
                ).finally(()=>{
                    this.setState({ updating: this.state.updating - 1 });
                });
            },
        });
    },

    onBanOrUnban: function() {
        const ConfirmUserActionDialog = sdk.getComponent("dialogs.ConfirmUserActionDialog");
        Modal.createTrackedDialog('Confirm User Action Dialog', 'onBanOrUnban', ConfirmUserActionDialog, {
            member: this.props.member,
            action: this.props.member.membership === 'ban' ? _t("Unban") : _t("Ban"),
            title: this.props.member.membership === 'ban' ? _t("Unban this user?") : _t("Ban this user?"),
            askReason: this.props.member.membership !== 'ban',
            danger: this.props.member.membership !== 'ban',
            onFinished: (proceed, reason) => {
                if (!proceed) return;

                this.setState({ updating: this.state.updating + 1 });
                let promise;
                if (this.props.member.membership === 'ban') {
                    promise = this.props.matrixClient.unban(
                        this.props.member.roomId, this.props.member.userId,
                    );
                } else {
                    promise = this.props.matrixClient.ban(
                        this.props.member.roomId, this.props.member.userId,
                        reason || undefined,
                    );
                }
                promise.then(
                    function() {
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
                    },
                ).finally(()=>{
                    this.setState({ updating: this.state.updating - 1 });
                });
            },
        });
    },

    _warnSelfDemote: function() {
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        return new Promise((resolve) => {
            Modal.createTrackedDialog('Demoting Self', '', QuestionDialog, {
                title: _t("Demote yourself?"),
                description:
                    <div>
                        { _t("You will not be able to undo this change as you are demoting yourself, " +
                            "if you are the last privileged user in the room it will be impossible " +
                            "to regain privileges.") }
                    </div>,
                button: _t("Demote"),
                onFinished: resolve,
            });
        });
    },

    onMuteToggle: async function() {
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        const roomId = this.props.member.roomId;
        const target = this.props.member.userId;
        const room = this.props.matrixClient.getRoom(roomId);
        if (!room) return;

        // if muting self, warn as it may be irreversible
        if (target === this.props.matrixClient.getUserId()) {
            try {
                if (!(await this._warnSelfDemote())) return;
            } catch (e) {
                console.error("Failed to warn about self demotion: ", e);
                return;
            }
        }

        const powerLevelEvent = room.currentState.getStateEvents("m.room.power_levels", "");
        if (!powerLevelEvent) return;

        const isMuted = this.state.muted;
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
            this.setState({ updating: this.state.updating + 1 });
            this.props.matrixClient.setPowerLevel(roomId, target, level, powerLevelEvent).then(
                function() {
                    // NO-OP; rely on the m.room.member event coming down else we could
                    // get out of sync if we force setState here!
                    console.log("Mute toggle success");
                }, function(err) {
                    console.error("Mute error: " + err);
                    Modal.createTrackedDialog('Failed to mute user', '', ErrorDialog, {
                        title: _t("Error"),
                        description: _t("Failed to mute user"),
                    });
                },
            ).finally(()=>{
                this.setState({ updating: this.state.updating - 1 });
            });
        }
    },

    onModToggle: function() {
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        const roomId = this.props.member.roomId;
        const target = this.props.member.userId;
        const room = this.props.matrixClient.getRoom(roomId);
        if (!room) return;

        const powerLevelEvent = room.currentState.getStateEvents("m.room.power_levels", "");
        if (!powerLevelEvent) return;

        const me = room.getMember(this.props.matrixClient.credentials.userId);
        if (!me) return;

        const defaultLevel = powerLevelEvent.getContent().users_default;
        let modLevel = me.powerLevel - 1;
        if (modLevel > 50 && defaultLevel < 50) modLevel = 50; // try to stick with the vector level defaults
        // toggle the level
        const newLevel = this.state.isTargetMod ? defaultLevel : modLevel;
        this.setState({ updating: this.state.updating + 1 });
        this.props.matrixClient.setPowerLevel(roomId, target, parseInt(newLevel), powerLevelEvent).then(
            function() {
                // NO-OP; rely on the m.room.member event coming down else we could
                // get out of sync if we force setState here!
                console.log("Mod toggle success");
            }, function(err) {
                if (err.errcode === 'M_GUEST_ACCESS_FORBIDDEN') {
                    dis.dispatch({action: 'view_set_mxid'});
                } else {
                    console.error("Toggle moderator error:" + err);
                    Modal.createTrackedDialog('Failed to toggle moderator status', '', ErrorDialog, {
                        title: _t("Error"),
                        description: _t("Failed to toggle moderator status"),
                    });
                }
            },
        ).finally(()=>{
            this.setState({ updating: this.state.updating - 1 });
        });
    },

    _applyPowerChange: function(roomId, target, powerLevel, powerLevelEvent) {
        this.setState({ updating: this.state.updating + 1 });
        this.props.matrixClient.setPowerLevel(roomId, target, parseInt(powerLevel), powerLevelEvent).then(
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
        ).finally(()=>{
            this.setState({ updating: this.state.updating - 1 });
        }).done();
    },

    onPowerChange: async function(powerLevel) {
        const roomId = this.props.member.roomId;
        const target = this.props.member.userId;
        const room = this.props.matrixClient.getRoom(roomId);
        if (!room) return;

        const powerLevelEvent = room.currentState.getStateEvents("m.room.power_levels", "");
        if (!powerLevelEvent) return;

        if (!powerLevelEvent.getContent().users) {
            this._applyPowerChange(roomId, target, powerLevel, powerLevelEvent);
            return;
        }

        const myUserId = this.props.matrixClient.getUserId();
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");

        // If we are changing our own PL it can only ever be decreasing, which we cannot reverse.
        if (myUserId === target) {
            try {
                if (!(await this._warnSelfDemote())) return;
                this._applyPowerChange(roomId, target, powerLevel, powerLevelEvent);
            } catch (e) {
                console.error("Failed to warn about self demotion: ", e);
            }
            return;
        }

        const myPower = powerLevelEvent.getContent().users[myUserId];
        if (parseInt(myPower) === parseInt(powerLevel)) {
            Modal.createTrackedDialog('Promote to PL100 Warning', '', QuestionDialog, {
                title: _t("Warning!"),
                description:
                    <div>
                        { _t("You will not be able to undo this change as you are promoting the user " +
                            "to have the same power level as yourself.") }<br />
                        { _t("Are you sure?") }
                    </div>,
                button: _t("Continue"),
                onFinished: (confirmed) => {
                    if (confirmed) {
                        this._applyPowerChange(roomId, target, powerLevel, powerLevelEvent);
                    }
                },
            });
            return;
        }
        this._applyPowerChange(roomId, target, powerLevel, powerLevelEvent);
    },

    onNewDMClick: function() {
        this.setState({ updating: this.state.updating + 1 });
        createRoom({dmUserId: this.props.member.userId}).finally(() => {
            this.setState({ updating: this.state.updating - 1 });
        }).done();
    },

    onLeaveClick: function() {
        dis.dispatch({
            action: 'leave_room',
            room_id: this.props.member.roomId,
        });
    },

    _calculateOpsPermissions: function(member) {
        const defaultPerms = {
            can: {},
            muted: false,
        };
        const room = this.props.matrixClient.getRoom(member.roomId);
        if (!room) return defaultPerms;

        const powerLevels = room.currentState.getStateEvents("m.room.power_levels", "");
        if (!powerLevels) return defaultPerms;

        const me = room.getMember(this.props.matrixClient.credentials.userId);
        if (!me) return defaultPerms;

        const them = member;
        return {
            can: this._calculateCanPermissions(
                me, them, powerLevels.getContent(),
            ),
            muted: this._isMuted(them, powerLevels.getContent()),
            isTargetMod: them.powerLevel > powerLevels.getContent().users_default,
        };
    },

    _calculateCanPermissions: function(me, them, powerLevels) {
        const isMe = me.userId === them.userId;
        const can = {
            kick: false,
            ban: false,
            mute: false,
            modifyLevel: false,
            modifyLevelMax: 0,
        };
        const canAffectUser = them.powerLevel < me.powerLevel || isMe;
        if (!canAffectUser) {
            //console.log("Cannot affect user: %s >= %s", them.powerLevel, me.powerLevel);
            return can;
        }
        const editPowerLevel = (
            (powerLevels.events ? powerLevels.events["m.room.power_levels"] : null) ||
            powerLevels.state_default
        );

        can.kick = me.powerLevel >= powerLevels.kick;
        can.ban = me.powerLevel >= powerLevels.ban;
        can.mute = me.powerLevel >= editPowerLevel;
        can.modifyLevel = me.powerLevel >= editPowerLevel && (isMe || me.powerLevel > them.powerLevel);
        can.modifyLevelMax = me.powerLevel;

        return can;
    },

    _isMuted: function(member, powerLevelContent) {
        if (!powerLevelContent || !member) return false;

        const levelToSend = (
            (powerLevelContent.events ? powerLevelContent.events["m.room.message"] : null) ||
            powerLevelContent.events_default
        );
        return member.powerLevel < levelToSend;
    },

    onCancel: function(e) {
        dis.dispatch({
            action: "view_user",
            member: null,
        });
    },

    onMemberAvatarClick: function() {
        const member = this.props.member;
        const avatarUrl = member.user ? member.user.avatarUrl : member.events.member.getContent().avatar_url;
        if (!avatarUrl) return;

        const httpUrl = this.props.matrixClient.mxcUrlToHttp(avatarUrl);
        const ImageView = sdk.getComponent("elements.ImageView");
        const params = {
            src: httpUrl,
            name: member.name,
        };

        Modal.createDialog(ImageView, params, "mx_Dialog_lightbox");
    },

    onRoomTileClick(roomId) {
        dis.dispatch({
            action: 'view_room',
            room_id: roomId,
        });
    },

    _renderDevices: function() {
        if (!this._enableDevices) return null;

        const devices = this.state.devices;
        const MemberDeviceInfo = sdk.getComponent('rooms.MemberDeviceInfo');
        const Spinner = sdk.getComponent("elements.Spinner");

        let devComponents;
        if (this.state.devicesLoading) {
            // still loading
            devComponents = <Spinner />;
        } else if (devices === null) {
            devComponents = _t("Unable to load device list");
        } else if (devices.length === 0) {
            devComponents = _t("No devices with registered encryption keys");
        } else {
            devComponents = [];
            for (let i = 0; i < devices.length; i++) {
                devComponents.push(<MemberDeviceInfo key={i}
                                       userId={this.props.member.userId}
                                       device={devices[i]} />);
            }
        }

        return (
            <div>
                <h3>{ _t("Devices") }</h3>
                <div className="mx_MemberInfo_devices">
                    { devComponents }
                </div>
            </div>
        );
    },

    onShareUserClick: function() {
        const ShareDialog = sdk.getComponent("dialogs.ShareDialog");
        Modal.createTrackedDialog('share room member dialog', '', ShareDialog, {
            target: this.props.member,
        });
    },

    _renderUserOptions: function() {
        const cli = this.props.matrixClient;
        const member = this.props.member;

        let ignoreButton = null;
        let insertPillButton = null;
        let inviteUserButton = null;
        let readReceiptButton = null;

        // Only allow the user to ignore the user if its not ourselves
        // same goes for jumping to read receipt
        if (member.userId !== cli.getUserId()) {
            ignoreButton = (
                <AccessibleButton onClick={this.onIgnoreToggle} className="mx_MemberInfo_field">
                    { this.state.isIgnoring ? _t("Unignore") : _t("Ignore") }
                </AccessibleButton>
            );

            if (member.roomId) {
                const room = cli.getRoom(member.roomId);
                const eventId = room.getEventReadUpTo(member.userId);

                const onReadReceiptButton = function() {
                    dis.dispatch({
                        action: 'view_room',
                        highlighted: true,
                        event_id: eventId,
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
                    <AccessibleButton onClick={onReadReceiptButton} className="mx_MemberInfo_field">
                        { _t('Jump to read receipt') }
                    </AccessibleButton>
                );

                insertPillButton = (
                    <AccessibleButton onClick={onInsertPillButton} className={"mx_MemberInfo_field"}>
                        { _t('Mention') }
                    </AccessibleButton>
                );
            }

            if (!member || !member.membership || member.membership === 'leave') {
                const roomId = member && member.roomId ? member.roomId : RoomViewStore.getRoomId();
                const onInviteUserButton = async () => {
                    try {
                        await cli.invite(roomId, member.userId);
                    } catch (err) {
                        const ErrorDialog = sdk.getComponent('dialogs.ErrorDialog');
                        Modal.createTrackedDialog('Failed to invite', '', ErrorDialog, {
                            title: _t('Failed to invite'),
                            description: ((err && err.message) ? err.message : "Operation failed"),
                        });
                    }
                };

                inviteUserButton = (
                    <AccessibleButton onClick={onInviteUserButton} className="mx_MemberInfo_field">
                        { _t('Invite') }
                    </AccessibleButton>
                );
            }
        }

        const shareUserButton = (
            <AccessibleButton onClick={this.onShareUserClick} className="mx_MemberInfo_field">
                { _t('Share Link to User') }
            </AccessibleButton>
        );

        return (
            <div>
                <h3>{ _t("User Options") }</h3>
                <div className="mx_MemberInfo_buttons">
                    { readReceiptButton }
                    { shareUserButton }
                    { insertPillButton }
                    { ignoreButton }
                    { inviteUserButton }
                </div>
            </div>
        );
    },

    render: function() {
        let startChat;
        let kickButton;
        let banButton;
        let muteButton;
        let giveModButton;
        let spinner;

        if (this.props.member.userId !== this.props.matrixClient.credentials.userId) {
            const dmRoomMap = new DMRoomMap(this.props.matrixClient);
            // dmRooms will not include dmRooms that we have been invited into but did not join.
            // Because DMRoomMap runs off account_data[m.direct] which is only set on join of dm room.
            // XXX: we potentially want DMs we have been invited to, to also show up here :L
            // especially as logic below concerns specially if we haven't joined but have been invited
            const dmRooms = dmRoomMap.getDMRoomsForUserId(this.props.member.userId);

            const RoomTile = sdk.getComponent("rooms.RoomTile");

            const tiles = [];
            for (const roomId of dmRooms) {
                const room = this.props.matrixClient.getRoom(roomId);
                if (room) {
                    const me = room.getMember(this.props.matrixClient.credentials.userId);

                    // not a DM room if we have are not joined
                    if (!me.membership || me.membership !== 'join') continue;
                    // not a DM room if they are not joined
                    const them = this.props.member;
                    if (!them.membership || them.membership !== 'join') continue;

                    const highlight = room.getUnreadNotificationCount('highlight') > 0 || me.membership === 'invite';

                    tiles.push(
                        <RoomTile key={room.roomId} room={room}
                            transparent={true}
                            collapsed={false}
                            selected={false}
                            unread={Unread.doesRoomHaveUnreadMessages(room)}
                            highlight={highlight}
                            isInvite={me.membership === "invite"}
                            onClick={this.onRoomTileClick}
                        />,
                    );
                }
            }

            const labelClasses = classNames({
                mx_MemberInfo_createRoom_label: true,
                mx_RoomTile_name: true,
            });
            const startNewChat = <AccessibleButton
                className="mx_MemberInfo_createRoom"
                onClick={this.onNewDMClick}
            >
                <div className="mx_RoomTile_avatar">
                    <img src="img/create-big.svg" width="26" height="26" />
                </div>
                <div className={labelClasses}><i>{ _t("Start a chat") }</i></div>
            </AccessibleButton>;

            startChat = <div>
                <h3>{ _t("Direct chats") }</h3>
                { tiles }
                { startNewChat }
            </div>;
        }

        if (this.state.updating) {
            const Loader = sdk.getComponent("elements.Spinner");
            spinner = <Loader imgClassName="mx_ContextualMenu_spinner" />;
        }

        if (this.state.can.kick) {
            const membership = this.props.member.membership;
            const kickLabel = membership === "invite" ? _t("Disinvite") : _t("Kick");
            kickButton = (
                <AccessibleButton className="mx_MemberInfo_field"
                        onClick={this.onKick}>
                    { kickLabel }
                </AccessibleButton>
            );
        }
        if (this.state.can.ban) {
            let label = _t("Ban");
            if (this.props.member.membership === 'ban') {
                label = _t("Unban");
            }
            banButton = (
                <AccessibleButton className="mx_MemberInfo_field"
                        onClick={this.onBanOrUnban}>
                    { label }
                </AccessibleButton>
            );
        }
        if (this.state.can.mute) {
            const muteLabel = this.state.muted ? _t("Unmute") : _t("Mute");
            muteButton = (
                <AccessibleButton className="mx_MemberInfo_field"
                        onClick={this.onMuteToggle}>
                    { muteLabel }
                </AccessibleButton>
            );
        }
        if (this.state.can.toggleMod) {
            const giveOpLabel = this.state.isTargetMod ? _t("Revoke Moderator") : _t("Make Moderator");
            giveModButton = <AccessibleButton className="mx_MemberInfo_field" onClick={this.onModToggle}>
                { giveOpLabel }
            </AccessibleButton>;
        }

        let adminTools;
        if (kickButton || banButton || muteButton || giveModButton) {
            adminTools =
                <div>
                    <h3>{ _t("Admin Tools") }</h3>

                    <div className="mx_MemberInfo_buttons">
                        { muteButton }
                        { kickButton }
                        { banButton }
                        { giveModButton }
                    </div>
                </div>;
        }

        const memberName = this.props.member.name;

        let presenceState;
        let presenceLastActiveAgo;
        let presenceCurrentlyActive;

        if (this.props.member.user) {
            presenceState = this.props.member.user.presence;
            presenceLastActiveAgo = this.props.member.user.lastActiveAgo;
            presenceCurrentlyActive = this.props.member.user.currentlyActive;
        }

        const room = this.props.matrixClient.getRoom(this.props.member.roomId);
        const powerLevelEvent = room ? room.currentState.getStateEvents("m.room.power_levels", "") : null;
        const powerLevelUsersDefault = powerLevelEvent ? powerLevelEvent.getContent().users_default : 0;

        const enablePresenceByHsUrl = SdkConfig.get()["enable_presence_by_hs_url"];
        const hsUrl = this.props.matrixClient.baseUrl;
        let showPresence = true;
        if (enablePresenceByHsUrl && enablePresenceByHsUrl[hsUrl] !== undefined) {
            showPresence = enablePresenceByHsUrl[hsUrl];
        }

        let presenceLabel = null;
        if (showPresence) {
            const PresenceLabel = sdk.getComponent('rooms.PresenceLabel');
            presenceLabel = <PresenceLabel activeAgo={presenceLastActiveAgo}
                currentlyActive={presenceCurrentlyActive}
                presenceState={presenceState} />;
        }

        let roomMemberDetails = null;
        if (this.props.member.roomId) { // is in room
            const PowerSelector = sdk.getComponent('elements.PowerSelector');
            roomMemberDetails = <div>
                <div className="mx_MemberInfo_profileField">
                    { _t("Level:") } <b>
                        <PowerSelector controlled={true}
                            value={parseInt(this.props.member.powerLevel)}
                            maxValue={this.state.can.modifyLevelMax}
                            disabled={!this.state.can.modifyLevel}
                            usersDefault={powerLevelUsersDefault}
                            onChange={this.onPowerChange} />
                    </b>
                </div>
                <div className="mx_MemberInfo_profileField">
                    {presenceLabel}
                </div>
            </div>;
        }

        const GeminiScrollbarWrapper = sdk.getComponent("elements.GeminiScrollbarWrapper");
        const MemberAvatar = sdk.getComponent('avatars.MemberAvatar');
        const EmojiText = sdk.getComponent('elements.EmojiText');
        return (
            <div className="mx_MemberInfo">
                <GeminiScrollbarWrapper autoshow={true}>
                    <AccessibleButton className="mx_MemberInfo_cancel" onClick={this.onCancel}>
                        <img src="img/cancel.svg" width="18" height="18" className="mx_filterFlipColor" />
                    </AccessibleButton>
                    <div className="mx_MemberInfo_avatar">
                        <MemberAvatar onClick={this.onMemberAvatarClick} member={this.props.member} width={48} height={48} />
                    </div>

                    <EmojiText element="h2">{ memberName }</EmojiText>

                    <div className="mx_MemberInfo_profile">
                        <div className="mx_MemberInfo_profileField">
                            { this.props.member.userId }
                        </div>
                        { roomMemberDetails }
                    </div>

                    { this._renderUserOptions() }

                    { adminTools }

                    { startChat }

                    { this._renderDevices() }

                    { spinner }
                </GeminiScrollbarWrapper>
            </div>
        );
    },
}));

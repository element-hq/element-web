/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 Vector Creations Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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
import createReactClass from 'create-react-class';
import classNames from 'classnames';
import dis from '../../../dispatcher/dispatcher';
import Modal from '../../../Modal';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import createRoom from '../../../createRoom';
import DMRoomMap from '../../../utils/DMRoomMap';
import * as Unread from '../../../Unread';
import { findReadReceiptFromUserId } from '../../../utils/Receipt';
import AccessibleButton from '../elements/AccessibleButton';
import RoomViewStore from '../../../stores/RoomViewStore';
import SdkConfig from '../../../SdkConfig';
import MultiInviter from "../../../utils/MultiInviter";
import SettingsStore from "../../../settings/SettingsStore";
import E2EIcon from "./E2EIcon";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import {Action} from "../../../dispatcher/actions";

export default createReactClass({
    displayName: 'MemberInfo',

    propTypes: {
        member: PropTypes.object.isRequired,
    },

    getInitialState: function() {
        return {
            can: {
                kick: false,
                ban: false,
                mute: false,
                modifyLevel: false,
                synapseDeactivate: false,
                redactMessages: false,
            },
            muted: false,
            isTargetMod: false,
            updating: 0,
            devicesLoading: true,
            devices: null,
            isIgnoring: false,
        };
    },

    statics: {
        contextType: MatrixClientContext,
    },

    // TODO: [REACT-WARNING] Move this to constructor
    UNSAFE_componentWillMount: function() {
        this._cancelDeviceList = null;
        const cli = this.context;

        // only display the devices list if our client supports E2E
        this._enableDevices = cli.isCryptoEnabled();

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

        this._updateStateForNewMember(this.props.member);
    },

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    UNSAFE_componentWillReceiveProps: function(newProps) {
        if (this.props.member.userId !== newProps.member.userId) {
            this._updateStateForNewMember(newProps.member);
        }
    },

    componentWillUnmount: function() {
        const client = this.context;
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
        const isIgnoring = this.context.isUserIgnored(this.props.member.userId);
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

            const devices = this.context.getStoredDevicesForUser(userId);
            this.setState({
                devices: devices,
                e2eStatus: this._getE2EStatus(devices),
            });
        }
    },

    _getE2EStatus: function(devices) {
        const hasUnverifiedDevice = devices.some((device) => device.isUnverified());
        return hasUnverifiedDevice ? "warning" : "verified";
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
        if (findReadReceiptFromUserId(receiptEvent, this.context.credentials.userId)) {
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

    _updateStateForNewMember: async function(member) {
        const newState = await this._calculateOpsPermissions(member);
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

        const client = this.context;
        const self = this;
        client.downloadKeys([member.userId], true).then(() => {
            return client.getStoredDevicesForUser(member.userId);
        }).finally(function() {
            self._cancelDeviceList = null;
        }).then(function(devices) {
            if (cancelled) {
                // we got cancelled - presumably a different user now
                return;
            }

            self._disambiguateDevices(devices);
            self.setState({
                devicesLoading: false,
                devices: devices,
                e2eStatus: self._getE2EStatus(devices),
            });
        }, function(err) {
            console.log("Error downloading sessions", err);
            self.setState({devicesLoading: false});
        });
    },

    onIgnoreToggle: function() {
        const ignoredUsers = this.context.getIgnoredUsers();
        if (this.state.isIgnoring) {
            const index = ignoredUsers.indexOf(this.props.member.userId);
            if (index !== -1) ignoredUsers.splice(index, 1);
        } else {
            ignoredUsers.push(this.props.member.userId);
        }

        this.context.setIgnoredUsers(ignoredUsers).then(() => {
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
                this.context.kick(
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
                    promise = this.context.unban(
                        this.props.member.roomId, this.props.member.userId,
                    );
                } else {
                    promise = this.context.ban(
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

    onRedactAllMessages: async function() {
        const {roomId, userId} = this.props.member;
        const room = this.context.getRoom(roomId);
        if (!room) {
            return;
        }
        const timelineSet = room.getUnfilteredTimelineSet();
        let eventsToRedact = [];
        for (const timeline of timelineSet.getTimelines()) {
            eventsToRedact = timeline.getEvents().reduce((events, event) => {
                if (event.getSender() === userId && !event.isRedacted() && !event.isRedaction()) {
                    return events.concat(event);
                } else {
                    return events;
                }
            }, eventsToRedact);
        }

        const count = eventsToRedact.length;
        const user = this.props.member.name;

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
            const confirmed = await new Promise((resolve) => {
                Modal.createTrackedDialog('Remove recent messages by user', '', QuestionDialog, {
                    title: _t("Remove recent messages by %(user)s", {user}),
                    description:
                        <div>
                            <p>{ _t("You are about to remove %(count)s messages by %(user)s. This cannot be undone. Do you wish to continue?", {count, user}) }</p>
                            <p>{ _t("For a large amount of messages, this might take some time. Please don't refresh your client in the meantime.") }</p>
                        </div>,
                    button: _t("Remove %(count)s messages", {count}),
                    onFinished: resolve,
                });
            });

            if (!confirmed) {
                return;
            }

            // Submitting a large number of redactions freezes the UI,
            // so first yield to allow to rerender after closing the dialog.
            await Promise.resolve();

            console.info(`Started redacting recent ${count} messages for ${user} in ${roomId}`);
            await Promise.all(eventsToRedact.map(async event => {
                try {
                    await this.context.redactEvent(roomId, event.getId());
                } catch (err) {
                    // log and swallow errors
                    console.error("Could not redact", event.getId());
                    console.error(err);
                }
            }));
            console.info(`Finished redacting recent ${count} messages for ${user} in ${roomId}`);
        }
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
        const room = this.context.getRoom(roomId);
        if (!room) return;

        // if muting self, warn as it may be irreversible
        if (target === this.context.getUserId()) {
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
            this.context.setPowerLevel(roomId, target, level, powerLevelEvent).then(
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
        const room = this.context.getRoom(roomId);
        if (!room) return;

        const powerLevelEvent = room.currentState.getStateEvents("m.room.power_levels", "");
        if (!powerLevelEvent) return;

        const me = room.getMember(this.context.credentials.userId);
        if (!me) return;

        const defaultLevel = powerLevelEvent.getContent().users_default;
        let modLevel = me.powerLevel - 1;
        if (modLevel > 50 && defaultLevel < 50) modLevel = 50; // try to stick with the vector level defaults
        // toggle the level
        const newLevel = this.state.isTargetMod ? defaultLevel : modLevel;
        this.setState({ updating: this.state.updating + 1 });
        this.context.setPowerLevel(roomId, target, parseInt(newLevel), powerLevelEvent).then(
            function() {
                // NO-OP; rely on the m.room.member event coming down else we could
                // get out of sync if we force setState here!
                console.log("Mod toggle success");
            }, function(err) {
                if (err.errcode === 'M_GUEST_ACCESS_FORBIDDEN') {
                    dis.dispatch({action: 'require_registration'});
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

    onSynapseDeactivate: function() {
        const QuestionDialog = sdk.getComponent('views.dialogs.QuestionDialog');
        Modal.createTrackedDialog('Synapse User Deactivation', '', QuestionDialog, {
            title: _t("Deactivate user?"),
            description:
                <div>{ _t(
                    "Deactivating this user will log them out and prevent them from logging back in. Additionally, " +
                    "they will leave all the rooms they are in. This action cannot be reversed. Are you sure you want to " +
                    "deactivate this user?"
                ) }</div>,
            button: _t("Deactivate user"),
            danger: true,
            onFinished: (accepted) => {
                if (!accepted) return;
                this.context.deactivateSynapseUser(this.props.member.userId).catch(e => {
                    console.error("Failed to deactivate user");
                    console.error(e);

                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createTrackedDialog('Failed to deactivate Synapse user', '', ErrorDialog, {
                        title: _t('Failed to deactivate user'),
                        description: ((e && e.message) ? e.message : _t("Operation failed")),
                    });
                });
            },
        });
    },

    _applyPowerChange: function(roomId, target, powerLevel, powerLevelEvent) {
        this.setState({ updating: this.state.updating + 1 });
        this.context.setPowerLevel(roomId, target, parseInt(powerLevel), powerLevelEvent).then(
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
        });
    },

    onPowerChange: async function(powerLevel) {
        const roomId = this.props.member.roomId;
        const target = this.props.member.userId;
        const room = this.context.getRoom(roomId);
        if (!room) return;

        const powerLevelEvent = room.currentState.getStateEvents("m.room.power_levels", "");
        if (!powerLevelEvent) return;

        if (!powerLevelEvent.getContent().users) {
            this._applyPowerChange(roomId, target, powerLevel, powerLevelEvent);
            return;
        }

        const myUserId = this.context.getUserId();
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
        });
    },

    onLeaveClick: function() {
        dis.dispatch({
            action: 'leave_room',
            room_id: this.props.member.roomId,
        });
    },

    _calculateOpsPermissions: async function(member) {
        let canDeactivate = false;
        if (this.context) {
            try {
                canDeactivate = await this.context.isSynapseAdministrator();
            } catch (e) {
                console.error(e);
            }
        }

        const defaultPerms = {
            can: {
                // Calculate permissions for Synapse before doing the PL checks
                synapseDeactivate: canDeactivate,
            },
            muted: false,
        };
        const room = this.context.getRoom(member.roomId);
        if (!room) return defaultPerms;

        const powerLevels = room.currentState.getStateEvents("m.room.power_levels", "");
        if (!powerLevels) return defaultPerms;

        const me = room.getMember(this.context.credentials.userId);
        if (!me) return defaultPerms;

        const them = member;
        return {
            can: {
                ...defaultPerms.can,
                ...await this._calculateCanPermissions(me, them, powerLevels.getContent()),
            },
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
            redactMessages: me.powerLevel >= powerLevels.redact,
        };

        const canAffectUser = them.powerLevel < me.powerLevel || isMe;
        if (!canAffectUser) {
            //console.info("Cannot affect user: %s >= %s", them.powerLevel, me.powerLevel);
            return can;
        }
        const editPowerLevel = (
            (powerLevels.events ? powerLevels.events["m.room.power_levels"] : null) ||
            powerLevels.state_default
        );

        can.kick = me.powerLevel >= powerLevels.kick;
        can.ban = me.powerLevel >= powerLevels.ban;
        can.invite = me.powerLevel >= powerLevels.invite;
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
            action: Action.ViewUser,
            member: null,
        });
    },

    onMemberAvatarClick: function() {
        const member = this.props.member;
        const avatarUrl = member.getMxcAvatarUrl();
        if (!avatarUrl) return;

        const httpUrl = this.context.mxcUrlToHttp(avatarUrl);
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
            devComponents = _t("Unable to load session list");
        } else if (devices.length === 0) {
            devComponents = _t("No sessions with registered encryption keys");
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
                <h3>{ _t("Sessions") }</h3>
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
        const cli = this.context;
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

            if (this.state.can.invite && (!member || !member.membership || member.membership === 'leave')) {
                const roomId = member && member.roomId ? member.roomId : RoomViewStore.getRoomId();
                const onInviteUserButton = async () => {
                    try {
                        // We use a MultiInviter to re-use the invite logic, even though
                        // we're only inviting one user.
                        const inviter = new MultiInviter(roomId);
                        await inviter.invite([member.userId]).then(() => {
                            if (inviter.getCompletionState(member.userId) !== "invited")
                                throw new Error(inviter.getErrorText(member.userId));
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
        let redactButton;
        let synapseDeactivateButton;
        let spinner;

        if (this.props.member.userId !== this.context.credentials.userId) {
            // TODO: Immutable DMs replaces a lot of this
            const dmRoomMap = new DMRoomMap(this.context);
            // dmRooms will not include dmRooms that we have been invited into but did not join.
            // Because DMRoomMap runs off account_data[m.direct] which is only set on join of dm room.
            // XXX: we potentially want DMs we have been invited to, to also show up here :L
            // especially as logic below concerns specially if we haven't joined but have been invited
            const dmRooms = dmRoomMap.getDMRoomsForUserId(this.props.member.userId);

            const RoomTile = sdk.getComponent("rooms.RoomTile");

            const tiles = [];
            for (const roomId of dmRooms) {
                const room = this.context.getRoom(roomId);
                if (room) {
                    const myMembership = room.getMyMembership();
                    // not a DM room if we have are not joined
                    if (myMembership !== 'join') continue;

                    const them = this.props.member;
                    // not a DM room if they are not joined
                    if (!them.membership || them.membership !== 'join') continue;

                    const highlight = room.getUnreadNotificationCount('highlight') > 0;

                    tiles.push(
                        <RoomTile key={room.roomId} room={room}
                            transparent={true}
                            collapsed={false}
                            selected={false}
                            unread={Unread.doesRoomHaveUnreadMessages(room)}
                            highlight={highlight}
                            isInvite={false}
                            onClick={this.onRoomTileClick}
                        />,
                    );
                }
            }

            const labelClasses = classNames({
                mx_MemberInfo_createRoom_label: true,
                mx_RoomTile_name: true,
            });
            let startNewChat = <AccessibleButton
                className="mx_MemberInfo_createRoom"
                onClick={this.onNewDMClick}
            >
                <div className="mx_RoomTile_avatar">
                    <img src={require("../../../../res/img/create-big.svg")} width="26" height="26" />
                </div>
                <div className={labelClasses}><i>{ _t("Start a chat") }</i></div>
            </AccessibleButton>;

            if (tiles.length > 0) startNewChat = null; // Don't offer a button for a new chat if we have one.

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

        if (this.state.can.redactMessages) {
            redactButton = (
                <AccessibleButton className="mx_MemberInfo_field" onClick={this.onRedactAllMessages}>
                    { _t("Remove recent messages") }
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

        // We don't need a perfect check here, just something to pass as "probably not our homeserver". If
        // someone does figure out how to bypass this check the worst that happens is an error.
        const sameHomeserver = this.props.member.userId.endsWith(`:${MatrixClientPeg.getHomeserverName()}`);
        if (this.state.can.synapseDeactivate && sameHomeserver) {
            synapseDeactivateButton = (
                <AccessibleButton onClick={this.onSynapseDeactivate} className="mx_MemberInfo_field">
                    {_t("Deactivate user")}
                </AccessibleButton>
            );
        }

        let adminTools;
        if (kickButton || banButton || muteButton || giveModButton || synapseDeactivateButton || redactButton) {
            adminTools =
                <div>
                    <h3>{ _t("Admin Tools") }</h3>

                    <div className="mx_MemberInfo_buttons">
                        { muteButton }
                        { kickButton }
                        { banButton }
                        { redactButton }
                        { giveModButton }
                        { synapseDeactivateButton }
                    </div>
                </div>;
        }

        const memberName = this.props.member.name;

        let presenceState;
        let presenceLastActiveAgo;
        let presenceCurrentlyActive;
        let statusMessage;

        if (this.props.member.user) {
            presenceState = this.props.member.user.presence;
            presenceLastActiveAgo = this.props.member.user.lastActiveAgo;
            presenceCurrentlyActive = this.props.member.user.currentlyActive;

            if (SettingsStore.isFeatureEnabled("feature_custom_status")) {
                statusMessage = this.props.member.user._unstable_statusMessage;
            }
        }

        const room = this.context.getRoom(this.props.member.roomId);
        const powerLevelEvent = room ? room.currentState.getStateEvents("m.room.power_levels", "") : null;
        const powerLevelUsersDefault = powerLevelEvent ? powerLevelEvent.getContent().users_default : 0;

        const enablePresenceByHsUrl = SdkConfig.get()["enable_presence_by_hs_url"];
        const hsUrl = this.context.baseUrl;
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

        let statusLabel = null;
        if (statusMessage) {
            statusLabel = <span className="mx_MemberInfo_statusMessage">{ statusMessage }</span>;
        }

        let roomMemberDetails = null;
        let e2eIconElement;

        if (this.props.member.roomId) { // is in room
            const PowerSelector = sdk.getComponent('elements.PowerSelector');
            roomMemberDetails = <div>
                <div className="mx_MemberInfo_profileField">
                    <PowerSelector
                        value={parseInt(this.props.member.powerLevel)}
                        maxValue={this.state.can.modifyLevelMax}
                        disabled={!this.state.can.modifyLevel}
                        usersDefault={powerLevelUsersDefault}
                        onChange={this.onPowerChange} />
                </div>
                <div className="mx_MemberInfo_profileField">
                    {presenceLabel}
                    {statusLabel}
                </div>
            </div>;

            const isEncrypted = this.context.isRoomEncrypted(this.props.member.roomId);
            if (this.state.e2eStatus && isEncrypted) {
                e2eIconElement = (<E2EIcon status={this.state.e2eStatus} isUser={true} />);
            }
        }

        const {member} = this.props;
        const avatarUrl = member.avatarUrl || (member.getMxcAvatarUrl && member.getMxcAvatarUrl());
        let avatarElement;
        if (avatarUrl) {
            const httpUrl = this.context.mxcUrlToHttp(avatarUrl, 800, 800);
            avatarElement = <div className="mx_MemberInfo_avatar">
                <img src={httpUrl} />
            </div>;
        }

        let backButton;
        if (this.props.member.roomId) {
            backButton = (<AccessibleButton className="mx_MemberInfo_cancel"
                onClick={this.onCancel}
                title={_t('Close')}
            />);
        }

        return (
            <div className="mx_MemberInfo" role="tabpanel">
                <div className="mx_MemberInfo_name">
                    { backButton }
                    { e2eIconElement }
                    <h2>{ memberName }</h2>
                </div>
                { avatarElement }
                <div className="mx_MemberInfo_container">

                    <div className="mx_MemberInfo_profile">
                        <div className="mx_MemberInfo_profileField">
                            { this.props.member.userId }
                        </div>
                        { roomMemberDetails }
                    </div>
                </div>
                <AutoHideScrollbar className="mx_MemberInfo_scrollContainer">
                    <div className="mx_MemberInfo_container">
                        { this._renderUserOptions() }

                        { adminTools }

                        { startChat }

                        { this._renderDevices() }

                        { spinner }
                    </div>
                </AutoHideScrollbar>
            </div>
        );
    },
});

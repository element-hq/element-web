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
var React = require('react');
var MatrixClientPeg = require("../../../MatrixClientPeg");
var dis = require("../../../dispatcher");
var Modal = require("../../../Modal");
var sdk = require('../../../index');

module.exports = React.createClass({
    displayName: 'MemberInfo',

    getDefaultProps: function() {
        return {
            onFinished: function() {}
        };
    },

    componentDidMount: function() {
        // work out the current state
        if (this.props.member) {
            var memberState = this._calculateOpsPermissions(this.props.member);
            this.setState(memberState);
        }
    },

    componentWillReceiveProps: function(newProps) {
        var memberState = this._calculateOpsPermissions(newProps.member);
        this.setState(memberState);
    },

    onKick: function() {
        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        var roomId = this.props.member.roomId;
        var target = this.props.member.userId;
        MatrixClientPeg.get().kick(roomId, target).done(function() {
            // NO-OP; rely on the m.room.member event coming down else we could
            // get out of sync if we force setState here!
            console.log("Kick success");
        }, function(err) {
            Modal.createDialog(ErrorDialog, {
                title: "Kick error",
                description: err.message
            });
        });
        this.props.onFinished();
    },

    onBan: function() {
        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        var roomId = this.props.member.roomId;
        var target = this.props.member.userId;
        MatrixClientPeg.get().ban(roomId, target).done(function() {
            // NO-OP; rely on the m.room.member event coming down else we could
            // get out of sync if we force setState here!
            console.log("Ban success");
        }, function(err) {
            Modal.createDialog(ErrorDialog, {
                title: "Ban error",
                description: err.message
            });
        });
        this.props.onFinished();
    },

    onMuteToggle: function() {
        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        var roomId = this.props.member.roomId;
        var target = this.props.member.userId;
        var room = MatrixClientPeg.get().getRoom(roomId);
        if (!room) {
            this.props.onFinished();
            return;
        }
        var powerLevelEvent = room.currentState.getStateEvents(
            "m.room.power_levels", ""
        );
        if (!powerLevelEvent) {
            this.props.onFinished();
            return;
        }
        var isMuted = this.state.muted;
        var powerLevels = powerLevelEvent.getContent();
        var levelToSend = (
            (powerLevels.events ? powerLevels.events["m.room.message"] : null) ||
            powerLevels.events_default
        );
        var level;
        if (isMuted) { // unmute
            level = levelToSend;
        }
        else { // mute
            level = levelToSend - 1;
        }

        MatrixClientPeg.get().setPowerLevel(roomId, target, level, powerLevelEvent).done(
        function() {
            // NO-OP; rely on the m.room.member event coming down else we could
            // get out of sync if we force setState here!
            console.log("Mute toggle success");
        }, function(err) {
            Modal.createDialog(ErrorDialog, {
                title: "Mute error",
                description: err.message
            });
        });
        this.props.onFinished();        
    },

    onModToggle: function() {
        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        var roomId = this.props.member.roomId;
        var target = this.props.member.userId;
        var room = MatrixClientPeg.get().getRoom(roomId);
        if (!room) {
            this.props.onFinished();
            return;
        }
        var powerLevelEvent = room.currentState.getStateEvents(
            "m.room.power_levels", ""
        );
        if (!powerLevelEvent) {
            this.props.onFinished();
            return;
        }
        var me = room.getMember(MatrixClientPeg.get().credentials.userId);
        if (!me) {
            this.props.onFinished();
            return;
        }
        var defaultLevel = powerLevelEvent.getContent().users_default;
        var modLevel = me.powerLevel - 1;
        // toggle the level
        var newLevel = this.state.isTargetMod ? defaultLevel : modLevel;
        MatrixClientPeg.get().setPowerLevel(roomId, target, newLevel, powerLevelEvent).done(
        function() {
            // NO-OP; rely on the m.room.member event coming down else we could
            // get out of sync if we force setState here!
            console.log("Mod toggle success");
        }, function(err) {
            Modal.createDialog(ErrorDialog, {
                title: "Mod error",
                description: err.message
            });
        });
        this.props.onFinished();        
    },

    onChatClick: function() {
        // check if there are any existing rooms with just us and them (1:1)
        // If so, just view that room. If not, create a private room with them.
        var self = this;
        var rooms = MatrixClientPeg.get().getRooms();
        var userIds = [
            this.props.member.userId,
            MatrixClientPeg.get().credentials.userId
        ];
        var existingRoomId = null;
        for (var i = 0; i < rooms.length; i++) {
            var members = rooms[i].getJoinedMembers();
            if (members.length === 2) {
                var hasTargetUsers = true;
                for (var j = 0; j < members.length; j++) {
                    if (userIds.indexOf(members[j].userId) === -1) {
                        hasTargetUsers = false;
                        break;
                    }
                }
                if (hasTargetUsers) {
                    existingRoomId = rooms[i].roomId;
                    break;
                }
            }
        }

        if (existingRoomId) {
            dis.dispatch({
                action: 'view_room',
                room_id: existingRoomId
            });
            this.props.onFinished();
        }
        else {
            self.setState({ creatingRoom: true });
            MatrixClientPeg.get().createRoom({
                invite: [this.props.member.userId],
                preset: "private_chat"
            }).done(function(res) {
                self.setState({ creatingRoom: false });
                dis.dispatch({
                    action: 'view_room',
                    room_id: res.room_id
                });
                self.props.onFinished();
            }, function(err) {
                self.setState({ creatingRoom: false });
                console.error(
                    "Failed to create room: %s", JSON.stringify(err)
                );
                self.props.onFinished();
            });
        }
    },

    onLeaveClick: function() {
        dis.dispatch({
            action: 'leave_room',
            room_id: this.props.member.roomId,
        });
        this.props.onFinished();        
    },

    getInitialState: function() {
        return {
            can: {
                kick: false,
                ban: false,
                mute: false,
                modifyLevel: false
            },
            muted: false,
            isTargetMod: false,
            creatingRoom: false
        }
    },

    _calculateOpsPermissions: function(member) {
        var defaultPerms = {
            can: {},
            muted: false,
            modifyLevel: false
        };
        var room = MatrixClientPeg.get().getRoom(member.roomId);
        if (!room) {
            return defaultPerms;
        }
        var powerLevels = room.currentState.getStateEvents(
            "m.room.power_levels", ""
        );
        if (!powerLevels) {
            return defaultPerms;
        }
        var me = room.getMember(MatrixClientPeg.get().credentials.userId);
        var them = member;
        return {
            can: this._calculateCanPermissions(
                me, them, powerLevels.getContent()
            ),
            muted: this._isMuted(them, powerLevels.getContent()),
            isTargetMod: them.powerLevel > powerLevels.getContent().users_default
        };
    },

    _calculateCanPermissions: function(me, them, powerLevels) {
        var can = {
            kick: false,
            ban: false,
            mute: false,
            modifyLevel: false
        };
        var canAffectUser = them.powerLevel < me.powerLevel;
        if (!canAffectUser) {
            //console.log("Cannot affect user: %s >= %s", them.powerLevel, me.powerLevel);
            return can;
        }
        var editPowerLevel = (
            (powerLevels.events ? powerLevels.events["m.room.power_levels"] : null) ||
            powerLevels.state_default
        );
        can.kick = me.powerLevel >= powerLevels.kick;
        can.ban = me.powerLevel >= powerLevels.ban;
        can.mute = me.powerLevel >= editPowerLevel;
        can.modifyLevel = me.powerLevel > them.powerLevel;
        return can;
    },

    _isMuted: function(member, powerLevelContent) {
        if (!powerLevelContent || !member) {
            return false;
        }
        var levelToSend = (
            (powerLevelContent.events ? powerLevelContent.events["m.room.message"] : null) ||
            powerLevelContent.events_default
        );
        return member.powerLevel < levelToSend;
    },

    onCancel: function(e) {
        dis.dispatch({
            action: "view_user",
            member: null
        });
    },

    render: function() {
        var interactButton, kickButton, banButton, muteButton, giveModButton, spinner;
        if (this.props.member.userId === MatrixClientPeg.get().credentials.userId) {
            interactButton = <div className="mx_MemberInfo_field" onClick={this.onLeaveClick}>Leave room</div>;
        }
        else {
            interactButton = <div className="mx_MemberInfo_field" onClick={this.onChatClick}>Start chat</div>;
        }

        if (this.state.creatingRoom) {
            var Loader = sdk.getComponent("elements.Spinner");
            spinner = <Loader imgClassName="mx_ContextualMenu_spinner"/>;
        }

        if (this.state.can.kick) {
            kickButton = <div className="mx_MemberInfo_field" onClick={this.onKick}>
                Kick
            </div>;
        }
        if (this.state.can.ban) {
            banButton = <div className="mx_MemberInfo_field" onClick={this.onBan}>
                Ban
            </div>;
        }
        if (this.state.can.mute) {
            var muteLabel = this.state.muted ? "Unmute" : "Mute";
            muteButton = <div className="mx_MemberInfo_field" onClick={this.onMuteToggle}>
                {muteLabel}
            </div>;
        }
        if (this.state.can.modifyLevel) {
            var giveOpLabel = this.state.isTargetMod ? "Revoke Mod" : "Make Mod";
            giveModButton = <div className="mx_MemberInfo_field" onClick={this.onModToggle}>
                {giveOpLabel}
            </div>
        }

        var MemberAvatar = sdk.getComponent('avatars.MemberAvatar');
        return (
            <div className="mx_MemberInfo">
                <img className="mx_MemberInfo_cancel" src="img/cancel.svg" width="18" height="18" onClick={this.onCancel}/>
                <div className="mx_MemberInfo_avatar">
                    <MemberAvatar member={this.props.member} width={48} height={48} />
                </div>
                <h2>{ this.props.member.name }</h2>
                <div className="mx_MemberInfo_profileField">
                    { this.props.member.userId }
                </div>
                <div className="mx_MemberInfo_profileField">
                    power: { this.props.member.powerLevelNorm }%
                </div>
                <div className="mx_MemberInfo_buttons">
                    {interactButton}
                    {muteButton}
                    {kickButton}
                    {banButton}
                    {giveModButton}
                    {spinner}
                </div>
            </div>
        );
    }
});


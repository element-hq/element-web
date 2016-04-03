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
            }
        );
        this.props.onFinished();
    },

    onBan: function() {
        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        var roomId = this.props.member.roomId;
        var target = this.props.member.userId;
        MatrixClientPeg.get().ban(roomId, target).done(
            function() {
                // NO-OP; rely on the m.room.member event coming down else we could
                // get out of sync if we force setState here!
                console.log("Ban success");
            }, function(err) {
                Modal.createDialog(ErrorDialog, {
                    title: "Ban error",
                    description: err.message
                });
            }
        );
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
        level = parseInt(level);

        if (level !== NaN) {
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
                }
            );
        }
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
        if (modLevel > 50 && defaultLevel < 50) modLevel = 50; // try to stick with the vector level defaults
        // toggle the level
        var newLevel = this.state.isTargetMod ? defaultLevel : modLevel;
        MatrixClientPeg.get().setPowerLevel(roomId, target, parseInt(newLevel), powerLevelEvent).done(
            function() {
                // NO-OP; rely on the m.room.member event coming down else we could
                // get out of sync if we force setState here!
                console.log("Mod toggle success");
            }, function(err) {
                if (err.errcode == 'M_GUEST_ACCESS_FORBIDDEN') {
                    var NeedToRegisterDialog = sdk.getComponent("dialogs.NeedToRegisterDialog");
                    Modal.createDialog(NeedToRegisterDialog, {
                        title: "Please Register",
                        description: "This action cannot be performed by a guest user. Please register to be able to do this."
                    });
                } else {
                    Modal.createDialog(ErrorDialog, {
                        title: "Moderator toggle error",
                        description: err.message
                    });
                }
            }
        );
        this.props.onFinished();        
    },

    _applyPowerChange: function(roomId, target, powerLevel, powerLevelEvent) {
        MatrixClientPeg.get().setPowerLevel(roomId, target, parseInt(powerLevel), powerLevelEvent).done(
            function() {
                // NO-OP; rely on the m.room.member event coming down else we could
                // get out of sync if we force setState here!
                console.log("Power change success");
            }, function(err) {
                Modal.createDialog(ErrorDialog, {
                    title: "Failure to change power level",
                    description: err.message
                });
            }
        );
        this.props.onFinished();
    },

    onPowerChange: function(powerLevel) {
        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        var roomId = this.props.member.roomId;
        var target = this.props.member.userId;
        var room = MatrixClientPeg.get().getRoom(roomId);
        var self = this;
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
        if (powerLevelEvent.getContent().users) {
            var myPower = powerLevelEvent.getContent().users[MatrixClientPeg.get().credentials.userId];
            if (parseInt(myPower) === parseInt(powerLevel)) {
                var QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
                Modal.createDialog(QuestionDialog, {
                    title: "Warning",
                    description:
                        <div>
                            You will not be able to undo this change as you are promoting the user to have the same power level as yourself.<br/>
                            Are you sure?
                        </div>,
                    button: "Continue",
                    onFinished: function(confirmed) {
                        if (confirmed) {
                            self._applyPowerChange(roomId, target, powerLevel, powerLevelEvent);
                        }
                        else {
                            self.props.onFinished();
                        }
                    },
                });
            }
            else {
                this._applyPowerChange(roomId, target, powerLevel, powerLevelEvent);
            }
        }
        else {
            this._applyPowerChange(roomId, target, powerLevel, powerLevelEvent);
        }
    },    

    onChatClick: function() {
        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        // check if there are any existing rooms with just us and them (1:1)
        // If so, just view that room. If not, create a private room with them.
        var self = this;
        var rooms = MatrixClientPeg.get().getRooms();
        var userIds = [
            this.props.member.userId,
            MatrixClientPeg.get().credentials.userId
        ];
        var existingRoomId;

        var currentRoom = MatrixClientPeg.get().getRoom(this.props.member.roomId);
        var currentMembers = currentRoom.getJoinedMembers();
        // if we're currently in a 1:1 with this user, start a new chat
        if (currentMembers.length === 2 &&
            userIds.indexOf(currentMembers[0].userId) !== -1 &&
            userIds.indexOf(currentMembers[1].userId) !== -1)
        {
            existingRoomId = null;
        }
        // otherwise reuse the first private 1:1 we find
        else {
            existingRoomId = null;

            for (var i = 0; i < rooms.length; i++) {
                // don't try to reuse public 1:1 rooms
                var join_rules = rooms[i].currentState.getStateEvents("m.room.join_rules", '');
                if (join_rules && join_rules.getContent().join_rule === 'public') continue;

                var members = rooms[i].getJoinedMembers();
                if (members.length === 2 &&
                    userIds.indexOf(members[0].userId) !== -1 &&
                    userIds.indexOf(members[1].userId) !== -1)
                {
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

            if (MatrixClientPeg.get().isGuest()) {
                self.setState({ creatingRoom: false });
                var NeedToRegisterDialog = sdk.getComponent("dialogs.NeedToRegisterDialog");
                Modal.createDialog(NeedToRegisterDialog, {
                    title: "Please Register",
                    description: "Guest users can't create new rooms. Please register to create room and start a chat."
                });
                self.props.onFinished();                
                return;
            }

            MatrixClientPeg.get().createRoom({
                // XXX: FIXME: deduplicate this with "view_create_room" in MatrixChat
                invite: [this.props.member.userId],
                preset: "private_chat",
                // Allow guests by default since the room is private and they'd
                // need an invite. This means clicking on a 3pid invite email can
                // actually drop you right in to a chat.
                initial_state: [
                    {
                        content: {
                            guest_access: 'can_join'
                        },
                        type: 'm.room.guest_access',
                        state_key: '',
                    }
                ],                
            }).done(
                function(res) {
                    self.setState({ creatingRoom: false });
                    dis.dispatch({
                        action: 'view_room',
                        room_id: res.room_id
                    });
                    self.props.onFinished();
                }, function(err) {
                    self.setState({ creatingRoom: false });
                    Modal.createDialog(ErrorDialog, {
                        title: "Failure to start chat",
                        description: err.message
                    });
                    self.props.onFinished();
                }
            );
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
        if (!me) {
            return defaultPerms;
        }
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
        var levelToSend = (
            (powerLevels.events ? powerLevels.events["m.room.message"] : null) ||
            powerLevels.events_default
        );

        can.kick = me.powerLevel >= powerLevels.kick;
        can.ban = me.powerLevel >= powerLevels.ban;
        can.mute = me.powerLevel >= editPowerLevel;
        can.toggleMod = me.powerLevel > them.powerLevel && them.powerLevel >= levelToSend;
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

    onMemberAvatarClick: function () {
        var avatarUrl = this.props.member.user.avatarUrl;
        if(!avatarUrl) return;
        
        var httpUrl = MatrixClientPeg.get().mxcUrlToHttp(avatarUrl);
        var ImageView = sdk.getComponent("elements.ImageView");
        var params = {
            src: httpUrl,
            name: this.props.member.name
        };

        Modal.createDialog(ImageView, params, "mx_Dialog_lightbox");
    },

    render: function() {
        var startChat, kickButton, banButton, muteButton, giveModButton, spinner;
        if (this.props.member.userId !== MatrixClientPeg.get().credentials.userId) {
            // FIXME: we're referring to a vector component from react-sdk
            var BottomLeftMenuTile = sdk.getComponent('rooms.BottomLeftMenuTile');
            startChat = <BottomLeftMenuTile collapsed={ false } img="img/create-big.svg" label="Start chat" onClick={ this.onChatClick }/>
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
        if (this.state.can.toggleMod) {
            var giveOpLabel = this.state.isTargetMod ? "Revoke Moderator" : "Make Moderator";
            giveModButton = <div className="mx_MemberInfo_field" onClick={this.onModToggle}>
                {giveOpLabel}
            </div>
        }

        // TODO: we should have an invite button if this MemberInfo is showing a user who isn't actually in the current room yet
        // e.g. clicking on a linkified userid in a room

        var adminTools;
        if (kickButton || banButton || muteButton || giveModButton) {
            adminTools = 
                <div>
                    <h3>Admin tools</h3>

                    <div className="mx_MemberInfo_buttons">
                        {muteButton}
                        {kickButton}
                        {banButton}
                        {giveModButton}
                    </div>
                </div>
        }

        var MemberAvatar = sdk.getComponent('avatars.MemberAvatar');
        var PowerSelector = sdk.getComponent('elements.PowerSelector');
        return (
            <div className="mx_MemberInfo">
                <img className="mx_MemberInfo_cancel" src="img/cancel.svg" width="18" height="18" onClick={this.onCancel}/>
                <div className="mx_MemberInfo_avatar">
                    <MemberAvatar onClick={this.onMemberAvatarClick} member={this.props.member} width={48} height={48} />
                </div>

                <h2>{ this.props.member.name }</h2>

                <div className="mx_MemberInfo_profile">
                    <div className="mx_MemberInfo_profileField">
                        { this.props.member.userId }
                    </div>
                    <div className="mx_MemberInfo_profileField">
                        Level: <b><PowerSelector controlled={true} value={ parseInt(this.props.member.powerLevel) } disabled={ !this.state.can.modifyLevel } onChange={ this.onPowerChange }/></b>
                    </div>
                </div>

                { startChat }

                { adminTools }

                { spinner }
            </div>
        );
    }
});


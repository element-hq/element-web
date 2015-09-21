/*
Copyright 2015 OpenMarket Ltd

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

'use strict';
var MatrixClientPeg = require("../../MatrixClientPeg");
var dis = require("../../dispatcher");
var Modal = require("../../Modal");
var ComponentBroker = require('../../ComponentBroker');
var ErrorDialog = ComponentBroker.get("organisms/ErrorDialog");
var QuestionDialog = ComponentBroker.get("organisms/QuestionDialog");
var Loader = require("react-loader");

module.exports = {
    componentDidMount: function() {
        var self = this;

        // work out the current state
        if (this.props.member) {
            var usr = MatrixClientPeg.get().getUser(this.props.member.userId) || {};
            var memberState = this._calculateOpsPermissions();
            this.setState(memberState);
        }
    },

    onKick: function() {
        var roomId = this.props.member.roomId;
        var target = this.props.member.userId;
        var self = this;
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
        var roomId = this.props.member.roomId;
        var target = this.props.member.userId;
        var self = this;
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
        var roomId = this.props.member.roomId;
        var target = this.props.member.userId;
        var self = this;
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
        }
        else {
            MatrixClientPeg.get().createRoom({
                invite: [this.props.member.userId],
                preset: "private_chat"
            }).done(function(res) {
                dis.dispatch({
                    action: 'view_room',
                    room_id: res.room_id
                });
            }, function(err) {
                console.error(
                    "Failed to create room: %s", JSON.stringify(err)
                );
            });
        }
        this.props.onFinished();                
    },

    // FIXME: this is horribly duplicated with MemberTile's onLeaveClick.
    // Not sure what the right solution to this is.
    onLeaveClick: function() {
        console.log("leaving room");
        var roomId = this.props.member.roomId;
        Modal.createDialog(QuestionDialog, {
            title: "Leave room",
            description: "Are you sure you want to leave the room?",
            onFinished: function(should_leave) {
                if (should_leave) {
                    var d = MatrixClientPeg.get().leave(roomId);

                    var modal = Modal.createDialog(Loader);

                    d.then(function() {
                        modal.close();
                        dis.dispatch({action: 'view_next_room'});
                    }, function(err) {
                        modal.close();
                        Modal.createDialog(ErrorDialog, {
                            title: "Failed to leave room",
                            description: err.toString()
                        });
                    });
                }
            }
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
            isTargetMod: false
        }
    },

    _calculateOpsPermissions: function() {
        var defaultPerms = {
            can: {},
            muted: false,
            modifyLevel: false
        };
        var room = MatrixClientPeg.get().getRoom(this.props.member.roomId);
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
        var them = this.props.member;
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
    }
};


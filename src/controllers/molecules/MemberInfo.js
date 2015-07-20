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
 * 'presence' : string (online|offline|unavailable etc)
 * 'active' : number (ms ago; can be -1)
 */

'use strict';
var MatrixClientPeg = require("../../MatrixClientPeg");
var dis = require("../../dispatcher");

module.exports = {
    componentDidMount: function() {
        var self = this;
        function updateUserState(event, user) {
            if (!self.props.member) { return; }

            if (user.userId === self.props.member.userId) {
                self.setState({
                    presence: user.presence,
                    active: user.lastActiveAgo
                });
            }
        }
        MatrixClientPeg.get().on("User.presence", updateUserState);
        this.userPresenceFn = updateUserState;

        if (this.props.member) {
            var usr = MatrixClientPeg.get().getUser(this.props.member.userId);
            if (!usr) {
                return;
            }
            this.setState({
                presence: usr.presence,
                active: usr.lastActiveAgo
            });
        }
    },

    componentWillUnmount: function() {
        MatrixClientPeg.get().removeListener("User.presence", this.userPresenceFn);
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
    },

    getInitialState: function() {
        return {
            presence: "offline",
            active: -1
        }
    }
};


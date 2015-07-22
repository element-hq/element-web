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

'use strict';

var React = require("react");
var MatrixClientPeg = require("../../MatrixClientPeg");
var Modal = require("../../Modal");
var ComponentBroker = require('../../ComponentBroker');
var ErrorDialog = ComponentBroker.get("organisms/ErrorDialog");

var INITIAL_LOAD_NUM_MEMBERS = 50;

module.exports = {
    getInitialState: function() {
        var members = this.roomMembers(INITIAL_LOAD_NUM_MEMBERS);
        return {
            memberDict: members
        };
    },

    componentWillMount: function() {
        var cli = MatrixClientPeg.get();
        cli.on("RoomState.members", this.onRoomStateMember);
    },

    componentWillUnmount: function() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("RoomState.members", this.onRoomStateMember);
            MatrixClientPeg.get().removeListener("User.presence", this.userPresenceFn);
        }
    },

    componentDidMount: function() {
        var self = this;
        setTimeout(function() {
            if (!self.isMounted()) return;
            self.setState({
                memberDict: self.roomMembers()
            });
        }, 50);

        // Attach a SINGLE listener for global presence changes then locate the
        // member tile and re-render it. This is more efficient than every tile
        // evar attaching their own listener.
        function updateUserState(event, user) {
            var tile = self.refs[user.userId];
            if (tile) {
                tile.forceUpdate();
            }
        }
        MatrixClientPeg.get().on("User.presence", updateUserState);
        this.userPresenceFn = updateUserState;
    },
    // Remember to set 'key' on a MemberList to the ID of the room it's for
    /*componentWillReceiveProps: function(newProps) {
    },*/

    onRoomStateMember: function(ev, state, member) {
        var members = this.roomMembers();
        this.setState({
            memberDict: members
        });
    },

    onInvite: function(inputText) {
        var self = this;
        // sanity check the input
        inputText = inputText.trim(); // react requires es5-shim so we know trim() exists
        if (inputText[0] !== '@' || inputText.indexOf(":") === -1) {
            console.error("Bad user ID to invite: %s", inputText);
            Modal.createDialog(ErrorDialog, {
                title: "Invite Error",
                description: "Malformed user ID. Should look like '@localpart:domain'"
            });
            return;
        }
        self.setState({
            inviting: true
        });
        console.log("Invite %s to %s", inputText, this.props.roomId);
        MatrixClientPeg.get().invite(this.props.roomId, inputText).done(
        function(res) {
            console.log("Invited");
            self.setState({
                inviting: false
            });
        }, function(err) {
            console.error("Failed to invite: %s", JSON.stringify(err));
            Modal.createDialog(ErrorDialog, {
                title: "Server error whilst inviting",
                description: err.message
            });
            self.setState({
                inviting: false
            });
        });
    },

    roomMembers: function(limit) {
        if (!this.props.roomId) return {};
        var cli = MatrixClientPeg.get();
        var room = cli.getRoom(this.props.roomId);
        if (!room) return {};
        var all_members = room.currentState.members;
        var all_user_ids = Object.keys(all_members);

        all_user_ids.sort(function(userIdA, userIdB) {
            var userA = all_members[userIdA].user;
            var userB = all_members[userIdB].user;

            var latA = userA ? userA.lastActiveAgo || Number.MAX_VALUE : Number.MAX_VALUE;
            var latB = userB ? userB.lastActiveAgo || Number.MAX_VALUE : Number.MAX_VALUE;

            return latA - latB;
        });


        var to_display = {};
        var count = 0;
        for (var i = 0; i < all_user_ids.length && (limit === undefined || count < limit); ++i) {
            var user_id = all_user_ids[i];
            var m = all_members[user_id];

            if (m.membership == 'join' || m.membership == 'invite') {
                to_display[user_id] = m;
                ++count;
            }
        }
        return to_display;
    }
};


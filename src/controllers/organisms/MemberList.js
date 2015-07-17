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
        }
    },

    componentDidMount: function() {
        var that = this;
        setTimeout(function() {
            if (!that.isMounted()) return;
            that.setState({
                memberDict: that.roomMembers()
            });
        }, 50);
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

    roomMembers: function(limit) {
        if (!this.props.roomId) return {};
        var cli = MatrixClientPeg.get();
        var all_members = cli.getRoom(this.props.roomId).currentState.members;
        var all_user_ids = Object.keys(all_members);
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


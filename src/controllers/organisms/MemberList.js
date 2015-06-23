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

module.exports = {
    componentWillMount: function() {
        var cli = MatrixClientPeg.get();
        cli.on("RoomState.members", this.onRoomStateMember);

        this.setState({
            memberDict: cli.getRoom(this.props.roomId).currentState.members
        });
    },

    componentWillUnmount: function() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("RoomState.members", this.onRoomStateMember);
        }
    },

    // Remember to set 'key' on a MemberList to the ID of the room it's for
    /*componentWillReceiveProps: function(newProps) {
    },*/

    onRoomStateMember: function(ev, state, member) {
        var cli = MatrixClientPeg.get();
        this.setState({
            memberDict: cli.getRoom(this.props.roomId).currentState.members
        });
    }
};


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
    propTypes: {
        onRoomCreated: React.PropTypes.func,
    },

    getDefaultProps: function() {
        return {
            onRoomCreated: function() {},
        };
    },

    onCreateRoom: function() {
        var options = {};

        var room_name = this.getName();
        if (room_name) {
            options.name = room_name;
        }

        var preset = this.getPreset();
        if (preset) {
            options.preset = preset;
        }

        var invited_users = this.getInvitedUsers();
        if (invited_users) {
            options.invite = invited_users;
        }

        var cli = MatrixClientPeg.get();
        if (!cli) {
            // TODO: Error.
            console.error("Cannot create room: No matrix client.");
            return;
        }

        var deferred = MatrixClientPeg.get().createRoom(options);

        deferred.done(function () {
            this.props.onRoomCreated();
        });
    }
};

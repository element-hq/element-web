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

    phases: {
        CONFIG: "CONFIG",
        CREATING: "CREATING",
        CREATED: "CREATED",
        ERROR: "ERROR",
    },

    getDefaultProps: function() {
        return {
            onRoomCreated: function() {},
        };
    },

    getInitialState: function() {
        return {
            phase: this.phases.CONFIG,
            error_string: "",
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

        this.setState({
            phase: this.phases.CREATING,
        });

        var self = this;

        deferred.then(function () {
            self.setState({
                phase: self.phases.CREATED,
            });
            self.props.onRoomCreated();
        }, function(err) {
            self.setState({
                phase: self.phases.ERROR,
                error_string: err.toString(),
            });
        });
    }
};

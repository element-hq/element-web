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
var PresetValues = require('../atoms/create_room/Presets').Presets;
var q = require('q');
var encryption = require("../../encryption");

module.exports = {
    propTypes: {
        onRoomCreated: React.PropTypes.func,
    },

    phases: {
        CONFIG: "CONFIG",  // We're waiting for user to configure and hit create.
        CREATING: "CREATING",  // We're sending the request.
        CREATED: "CREATED",  // We successfully created the room.
        ERROR: "ERROR",  // There was an error while trying to create room.
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
            is_private: true,
            share_history: false,
            default_preset: PresetValues.PrivateChat,
            topic: '',
            room_name: '',
            invited_users: [],
        };
    },

    onCreateRoom: function() {
        var options = {};

        if (this.state.room_name) {
            options.name = this.state.room_name;
        }

        if (this.state.topic) {
            options.topic = this.state.topic;
        }

        if (this.state.preset) {
            if (this.state.preset != PresetValues.Custom) {
                options.preset = this.state.preset;
            } else {
                options.initial_state = [
                    {
                        type: "m.room.join_rules",
                        content: {
                            "join_rules": this.state.is_private ? "invite" : "public"
                        }
                    },
                    {
                        type: "m.room.history_visibility",
                        content: {
                            "history_visibility": this.state.share_history ? "shared" : "invited"
                        }
                    },
                ];
            }
        }

        options.invite = this.state.invited_users;

        var alias = this.getAliasLocalpart();
        if (alias) {
            options.room_alias_name = alias;
        }

        var cli = MatrixClientPeg.get();
        if (!cli) {
            // TODO: Error.
            console.error("Cannot create room: No matrix client.");
            return;
        }

        var deferred = cli.createRoom(options);

        var response;

        if (this.state.encrypt) {
            deferred = deferred.then(function(res) {
                response = res;
                return encryption.enableEncryption(
                    cli, response.roomId, options.invite
                );
            }).then(function() {
                return q(response) }
            );
        }

        this.setState({
            phase: this.phases.CREATING,
        });

        var self = this;

        deferred.then(function (resp) {
            self.setState({
                phase: self.phases.CREATED,
            });
            self.props.onRoomCreated(resp.room_id);
        }, function(err) {
            self.setState({
                phase: self.phases.ERROR,
                error_string: err.toString(),
            });
        });
    }
};

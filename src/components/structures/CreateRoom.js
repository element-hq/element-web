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

'use strict';

var React = require("react");
var MatrixClientPeg = require("../../MatrixClientPeg");
var PresetValues = {
    PrivateChat: "private_chat",
    PublicChat: "public_chat",
    Custom: "custom",
};
var q = require('q');
var sdk = require('../../index');

module.exports = React.createClass({
    displayName: 'CreateRoom',

    propTypes: {
        onRoomCreated: React.PropTypes.func,
        collapsedRhs: React.PropTypes.bool,
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
                            "join_rule": this.state.is_private ? "invite" : "public"
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

        if (this.state.encrypt) {
            // TODO
        }

        this.setState({
            phase: this.phases.CREATING,
        });

        var self = this;

        deferred.then(function(resp) {
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
    },

    getPreset: function() {
        return this.refs.presets.getPreset();
    },

    getName: function() {
        return this.refs.name_textbox.getName();
    },

    getTopic: function() {
        return this.refs.topic.getTopic();
    },

    getAliasLocalpart: function() {
        return this.refs.alias.getAliasLocalpart();
    },

    getInvitedUsers: function() {
        return this.refs.user_selector.getUserIds();
    },

    onPresetChanged: function(preset) {
        switch (preset) {
            case PresetValues.PrivateChat:
                this.setState({
                    preset: preset,
                    is_private: true,
                    share_history: false,
                });
                break;
            case PresetValues.PublicChat:
                this.setState({
                    preset: preset,
                    is_private: false,
                    share_history: true,
                });
                break;
            case PresetValues.Custom:
                this.setState({
                    preset: preset,
                });
                break;
        }
    },

    onPrivateChanged: function(ev) {
        this.setState({
            preset: PresetValues.Custom,
            is_private: ev.target.checked,
        });
    },

    onShareHistoryChanged: function(ev) {
        this.setState({
            preset: PresetValues.Custom,
            share_history: ev.target.checked,
        });
    },

    onTopicChange: function(ev) {
        this.setState({
            topic: ev.target.value,
        });
    },

    onNameChange: function(ev) {
        this.setState({
            room_name: ev.target.value,
        });
    },

    onInviteChanged: function(invited_users) {
        this.setState({
            invited_users: invited_users,
        });
    },

    onAliasChanged: function(alias) {
        this.setState({
            alias: alias
        });
    },

    onEncryptChanged: function(ev) {
        this.setState({
            encrypt: ev.target.checked,
        });
    },

    render: function() {
        var curr_phase = this.state.phase;
        if (curr_phase == this.phases.CREATING) {
            var Loader = sdk.getComponent("elements.Spinner");
            return (
                <Loader/>
            );
        } else {
            var error_box = "";
            if (curr_phase == this.phases.ERROR) {
                error_box = (
                    <div className="mx_Error">
                        An error occured: {this.state.error_string}
                    </div>
                );
            }

            var CreateRoomButton = sdk.getComponent("create_room.CreateRoomButton");
            var RoomAlias = sdk.getComponent("create_room.RoomAlias");
            var Presets = sdk.getComponent("create_room.Presets");
            var UserSelector = sdk.getComponent("elements.UserSelector");
            var SimpleRoomHeader = sdk.getComponent("rooms.SimpleRoomHeader");

            var domain = MatrixClientPeg.get().getDomain();

            return (
            <div className="mx_CreateRoom">
                <SimpleRoomHeader title="CreateRoom" collapsedRhs={ this.props.collapsedRhs }/>
                <div className="mx_CreateRoom_body">
                    <input type="text" ref="room_name" value={this.state.room_name} onChange={this.onNameChange} placeholder="Name"/> <br />
                    <textarea className="mx_CreateRoom_description" ref="topic" value={this.state.topic} onChange={this.onTopicChange} placeholder="Topic"/> <br />
                    <RoomAlias ref="alias" alias={this.state.alias} homeserver={ domain } onChange={this.onAliasChanged}/> <br />
                    <UserSelector ref="user_selector" selected_users={this.state.invited_users} onChange={this.onInviteChanged}/> <br />
                    <Presets ref="presets" onChange={this.onPresetChanged} preset={this.state.preset}/> <br />
                    <div>
                        <label>
                            <input type="checkbox" ref="is_private" checked={this.state.is_private} onChange={this.onPrivateChanged}/>
                            Make this room private
                        </label>
                    </div>
                    <div>
                        <label>
                            <input type="checkbox" ref="share_history" checked={this.state.share_history} onChange={this.onShareHistoryChanged}/>
                            Share message history with new users
                        </label>
                    </div>
                    <div className="mx_CreateRoom_encrypt">
                        <label>
                            <input type="checkbox" ref="encrypt" checked={this.state.encrypt} onChange={this.onEncryptChanged}/>
                            Encrypt room
                        </label>
                    </div>
                    <div>
                        <CreateRoomButton onCreateRoom={this.onCreateRoom} /> <br />
                    </div>
                    {error_box}
                </div>
            </div>
            );
        }
    }
});

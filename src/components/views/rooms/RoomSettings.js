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

var React = require('react');
var MatrixClientPeg = require('../../../MatrixClientPeg');
var Tinter = require('../../../Tinter');
var sdk = require('../../../index');

var room_colors = [
    // magic room default values courtesy of Ribot
    ["#76cfa6", "#eaf5f0"],
    ["#81bddb", "#eaf1f4"],
    ["#bd79cb", "#f3eaf5"],
    ["#c65d94", "#f5eaef"],
    ["#e55e5e", "#f5eaea"],
    ["#eca46f", "#f5eeea"],
    ["#dad658", "#f5f4ea"],
    ["#80c553", "#eef5ea"],
    ["#bb814e", "#eee8e3"],
    ["#595959", "#ececec"],
];

module.exports = React.createClass({
    displayName: 'RoomSettings',

    propTypes: {
        room: React.PropTypes.object.isRequired,
    },

    getInitialState: function() {
        // work out the initial color index
        var room_color_index = undefined;
        var color_scheme_event = this.props.room.getAccountData("org.matrix.room.color_scheme");
        if (color_scheme_event) {
            var color_scheme = color_scheme_event.getContent();
            if (color_scheme.primary_color) color_scheme.primary_color = color_scheme.primary_color.toLowerCase();
            if (color_scheme.secondary_color) color_scheme.secondary_color = color_scheme.secondary_color.toLowerCase();
            // XXX: we should validate these values
            for (var i = 0; i < room_colors.length; i++) {
                var room_color = room_colors[i];
                if (room_color[0] === color_scheme.primary_color &&
                    room_color[1] === color_scheme.secondary_color)
                {
                    room_color_index = i;
                    break;
                }
            }
            if (room_color_index === undefined) {
                // append the unrecognised colours to our palette
                room_color_index = room_colors.length;
                room_colors[room_color_index] = [ color_scheme.primary_color, color_scheme.secondary_color ];
            }
        }
        else {
            room_color_index = 0;
        }

        return {
            power_levels_changed: false,
            color_scheme_changed: false,
            color_scheme_index: room_color_index,
        };
    },

    getTopic: function() {
        return this.refs.topic.value;
    },

    getJoinRules: function() {
        return this.refs.is_private.checked ? "invite" : "public";
    },

    getHistoryVisibility: function() {
        return this.refs.share_history.checked ? "shared" : "invited";
    },

    getPowerLevels: function() {
        if (!this.state.power_levels_changed) return undefined;

        var power_levels = this.props.room.currentState.getStateEvents('m.room.power_levels', '');
        power_levels = power_levels.getContent();

        var new_power_levels = {
            ban: parseInt(this.refs.ban.value),
            kick: parseInt(this.refs.kick.value),
            redact: parseInt(this.refs.redact.value),
            invite: parseInt(this.refs.invite.value),
            events_default: parseInt(this.refs.events_default.value),
            state_default: parseInt(this.refs.state_default.value),
            users_default: parseInt(this.refs.users_default.value),
            users: power_levels.users,
            events: power_levels.events,
        };

        return new_power_levels;
    },

    onPowerLevelsChanged: function() {
        this.setState({
            power_levels_changed: true
        });
    },

    getColorScheme: function() {
        if (!this.state.color_scheme_changed) return undefined;

        return {
            primary_color: room_colors[this.state.color_scheme_index][0],
            secondary_color: room_colors[this.state.color_scheme_index][1],            
        };
    },

    onColorSchemeChanged: function(index) {
        // preview what the user just changed the scheme to.
        Tinter.tint(room_colors[index][0], room_colors[index][1]);

        this.setState({
            color_scheme_changed: true,
            color_scheme_index: index,
        });
    },

    render: function() {
        var ChangeAvatar = sdk.getComponent('settings.ChangeAvatar');

        var topic = this.props.room.currentState.getStateEvents('m.room.topic', '');
        if (topic) topic = topic.getContent().topic;

        var join_rule = this.props.room.currentState.getStateEvents('m.room.join_rules', '');
        if (join_rule) join_rule = join_rule.getContent().join_rule;

        var history_visibility = this.props.room.currentState.getStateEvents('m.room.history_visibility', '');
        if (history_visibility) history_visibility = history_visibility.getContent().history_visibility;

        var power_levels = this.props.room.currentState.getStateEvents('m.room.power_levels', '');

        var events_levels = power_levels.events || {};

        if (power_levels) {
            power_levels = power_levels.getContent();

            var ban_level = parseInt(power_levels.ban);
            var kick_level = parseInt(power_levels.kick);
            var redact_level = parseInt(power_levels.redact);
            var invite_level = parseInt(power_levels.invite || 0);
            var send_level = parseInt(power_levels.events_default || 0);
            var state_level = parseInt(power_levels.state_default || 0);
            var default_user_level = parseInt(power_levels.users_default || 0);

            if (power_levels.ban == undefined) ban_level = 50;
            if (power_levels.kick == undefined) kick_level = 50;
            if (power_levels.redact == undefined) redact_level = 50;

            var user_levels = power_levels.users || {};

            var user_id = MatrixClientPeg.get().credentials.userId;

            var current_user_level = user_levels[user_id];
            if (current_user_level == undefined) current_user_level = default_user_level;

            var power_level_level = events_levels["m.room.power_levels"];
            if (power_level_level == undefined) {
                power_level_level = state_level;
            }

            var can_change_levels = current_user_level >= power_level_level;
        } else {
            var ban_level = 50;
            var kick_level = 50;
            var redact_level = 50;
            var invite_level = 0;
            var send_level = 0;
            var state_level = 0;
            var default_user_level = 0;

            var user_levels = [];
            var events_levels = [];

            var current_user_level = 0;

            var power_level_level = 0;

            var can_change_levels = false;
        }

        var room_avatar_level = parseInt(power_levels.state_default || 0);
        if (events_levels['m.room.avatar'] !== undefined) {
            room_avatar_level = events_levels['m.room.avatar'];
        }
        var can_set_room_avatar = current_user_level >= room_avatar_level;

        var self = this;

        var room_colors_section =
            <div>
                <h3>Room Colour</h3>
                <div className="mx_RoomSettings_roomColors">
                    {room_colors.map(function(room_color, i) {
                        var selected;
                        if (i === self.state.color_scheme_index) {
                            selected =
                                <div className="mx_RoomSettings_roomColor_selected">
                                    <img src="img/tick.svg" width="17" height="14" alt="./"/>
                                </div>
                        }
                        var boundClick = self.onColorSchemeChanged.bind(self, i)
                        return (
                            <div className="mx_RoomSettings_roomColor"
                                  key={ "room_color_" + i }
                                  style={{ backgroundColor: room_color[1] }}
                                  onClick={ boundClick }>
                                { selected }
                                <div className="mx_RoomSettings_roomColorPrimary" style={{ backgroundColor: room_color[0] }}></div>
                            </div>
                        );
                    })}
                </div>
            </div>;

        var change_avatar;
        if (can_set_room_avatar) {
            change_avatar =
                <div>
                    <h3>Room Icon</h3>
                    <ChangeAvatar room={this.props.room} />
                </div>;
        }

        var banned = this.props.room.getMembersWithMembership("ban");

        var events_levels_section;
        if (events_levels.length) {
            events_levels_section = 
                <div>
                    <h3>Event levels</h3>
                    <div className="mx_RoomSettings_eventLevels mx_RoomSettings_settings">
                        {Object.keys(events_levels).map(function(event_type, i) {
                            return (
                                <div key={event_type}>
                                    <label htmlFor={"mx_RoomSettings_event_"+i}>{event_type}</label>
                                    <input type="text" defaultValue={events_levels[event_type]} size="3" id={"mx_RoomSettings_event_"+i} disabled/>
                                </div>
                            );
                        })}
                    </div>
                </div>;
        }

        var banned_users_section;
        if (banned.length) {
            banned_users_section =
                <div>
                    <h3>Banned users</h3>
                    <div className="mx_RoomSettings_banned">
                        {banned.map(function(member, i) {
                            return (
                                <div key={i}>
                                    {member.userId}
                                </div>
                            );
                        })}
                    </div>
                </div>;
        }

        return (
            <div className="mx_RoomSettings">
                <textarea className="mx_RoomSettings_description" placeholder="Topic" defaultValue={topic} ref="topic"/> <br/>
                <label><input type="checkbox" ref="is_private" defaultChecked={join_rule != "public"}/> Make this room private</label> <br/>
                <label><input type="checkbox" ref="share_history" defaultChecked={history_visibility == "shared"}/> Share message history with new users</label> <br/>
                <label className="mx_RoomSettings_encrypt"><input type="checkbox" /> Encrypt room</label>

                { room_colors_section }

                <h3>Power levels</h3>
                <div className="mx_RoomSettings_powerLevels mx_RoomSettings_settings">
                    <div>
                        <label htmlFor="mx_RoomSettings_ban_level">Ban level</label>
                        <input type="text" defaultValue={ban_level} size="3" ref="ban" id="mx_RoomSettings_ban_level"
                            disabled={!can_change_levels || current_user_level < ban_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div>
                        <label htmlFor="mx_RoomSettings_kick_level">Kick level</label>
                        <input type="text" defaultValue={kick_level} size="3" ref="kick" id="mx_RoomSettings_kick_level"
                            disabled={!can_change_levels || current_user_level < kick_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div>
                        <label htmlFor="mx_RoomSettings_redact_level">Redact level</label>
                        <input type="text" defaultValue={redact_level} size="3" ref="redact" id="mx_RoomSettings_redact_level"
                            disabled={!can_change_levels || current_user_level < redact_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div>
                        <label htmlFor="mx_RoomSettings_invite_level">Invite level</label>
                        <input type="text" defaultValue={invite_level} size="3" ref="invite" id="mx_RoomSettings_invite_level"
                            disabled={!can_change_levels || current_user_level < invite_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div>
                        <label htmlFor="mx_RoomSettings_event_level">Send event level</label>
                        <input type="text" defaultValue={send_level} size="3" ref="events_default" id="mx_RoomSettings_event_level"
                            disabled={!can_change_levels || current_user_level < send_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div>
                        <label htmlFor="mx_RoomSettings_state_level">Set state level</label>
                        <input type="text" defaultValue={state_level} size="3" ref="state_default" id="mx_RoomSettings_state_level"
                            disabled={!can_change_levels || current_user_level < state_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div>
                        <label htmlFor="mx_RoomSettings_user_level">Default user level</label>
                        <input type="text" defaultValue={default_user_level} size="3" ref="users_default"
                            id="mx_RoomSettings_user_level" disabled={!can_change_levels || current_user_level < default_user_level}
                            onChange={this.onPowerLevelsChanged}/>
                    </div>
                </div>

                <h3>User levels</h3>
                <div className="mx_RoomSettings_userLevels mx_RoomSettings_settings">
                    {Object.keys(user_levels).map(function(user, i) {
                        return (
                            <div key={user}>
                                <label htmlFor={"mx_RoomSettings_user_"+i}>{user}</label>
                                <input type="text" defaultValue={user_levels[user]} size="3" id={"mx_RoomSettings_user_"+i} disabled/>
                            </div>
                        );
                    })}
                </div>

                { events_levels_section }
                { banned_users_section }
                { change_avatar }
            </div>
        );
    }
});

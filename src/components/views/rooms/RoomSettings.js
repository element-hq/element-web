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
var sdk = require('../../../index');

module.exports = React.createClass({
    displayName: 'RoomSettings',

    propTypes: {
        room: React.PropTypes.object.isRequired,
    },

    getInitialState: function() {
        return {
            power_levels_changed: false
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

        var change_avatar;
        if (can_set_room_avatar) {
            change_avatar = <div>
                <h3>Room Icon</h3>
                <ChangeAvatar room={this.props.room} />
            </div>;
        }

        var banned = this.props.room.getMembersWithMembership("ban");

        return (
            <div className="mx_RoomSettings">
                <textarea className="mx_RoomSettings_description" placeholder="Topic" defaultValue={topic} ref="topic"/> <br/>
                <label><input type="checkbox" ref="is_private" defaultChecked={join_rule != "public"}/> Make this room private</label> <br/>
                <label><input type="checkbox" ref="share_history" defaultChecked={history_visibility == "shared"}/> Share message history with new users</label> <br/>
                <label className="mx_RoomSettings_encrypt"><input type="checkbox" /> Encrypt room</label> <br/>

                <h3>Power levels</h3>
                <div className="mx_RoomSettings_power_levels mx_RoomSettings_settings">
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
                <div className="mx_RoomSettings_user_levels mx_RoomSettings_settings">
                    {Object.keys(user_levels).map(function(user, i) {
                        return (
                            <div key={user}>
                                <label htmlFor={"mx_RoomSettings_user_"+i}>{user}</label>
                                <input type="text" defaultValue={user_levels[user]} size="3" id={"mx_RoomSettings_user_"+i} disabled/>
                            </div>
                        );
                    })}
                </div>

                <h3>Event levels</h3>
                <div className="mx_RoomSettings_event_lvels mx_RoomSettings_settings">
                    {Object.keys(events_levels).map(function(event_type, i) {
                        return (
                            <div key={event_type}>
                                <label htmlFor={"mx_RoomSettings_event_"+i}>{event_type}</label>
                                <input type="text" defaultValue={events_levels[event_type]} size="3" id={"mx_RoomSettings_event_"+i} disabled/>
                            </div>
                        );
                    })}
                </div>

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
                {change_avatar}
            </div>
        );
    }
});

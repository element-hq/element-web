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
            aliases_changed: false,
            aliases: [],
        };
    },

    canGuestsJoin: function() {
        return this.refs.guests_join.checked;
    },

    canGuestsRead: function() {
        return this.refs.guests_read.checked;
    },

    getTopic: function() {
        return this.refs.topic ? this.refs.topic.value : "";
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

    onAliasChanged: function(i, j) {

    },

    onAliasDeleted: function(i, j) {

    },

    onAliasAdded: function(i, j) {

    },

    render: function() {
        // TODO: go through greying out things you don't have permission to change
        // (or turning them into informative stuff)

        var EditableText = sdk.getComponent('elements.EditableText');
        var PowerSelector = sdk.getComponent('elements.PowerSelector');

        var join_rule = this.props.room.currentState.getStateEvents('m.room.join_rules', '');
        if (join_rule) join_rule = join_rule.getContent().join_rule;

        var history_visibility = this.props.room.currentState.getStateEvents('m.room.history_visibility', '');
        if (history_visibility) history_visibility = history_visibility.getContent().history_visibility;

        var power_levels = this.props.room.currentState.getStateEvents('m.room.power_levels', '');
        var guest_access = this.props.room.currentState.getStateEvents('m.room.guest_access', '');
        if (guest_access) {
            guest_access = guest_access.getContent().guest_access;
        }

        var events_levels = power_levels.events || {};

        var user_id = MatrixClientPeg.get().credentials.userId;

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

        var alias_events = this.props.room.currentState.getStateEvents('m.room.aliases');
        var canonical_alias_event = this.props.room.currentState.getStateEvents('m.room.canonical_alias', '');
        var canonical_alias = canonical_alias_event ? canonical_alias_event.getContent().alias : "";
        var domain = MatrixClientPeg.get().getDomain();

        var aliases_section =
            <div>
                <h3>Directory</h3>
                <div className="mx_RoomSettings_aliasLabel">
                    { alias_events.length ? "This room is accessible via:" : "This room has no aliases." }
                </div>
                <div className="mx_RoomSettings_aliasesTable">
                    { alias_events.map(function(alias_event, i) {
                        return alias_event.getContent().aliases.map(function(alias, j) {
                            var deleteButton;
                            if (alias_event && alias_event.getStateKey() === domain) {
                                deleteButton = <img src="img/cancel-small.svg" width="14" height="14" alt="Delete" onClick={ self.onAliasDeleted.bind(self, i, j) }/>;
                            }
                            return (
                                <div className="mx_RoomSettings_aliasesTableRow" key={ i + "_" + j }>
                                    <EditableText
                                         className="mx_RoomSettings_alias mx_RoomSettings_editable"
                                         placeholderClassName="mx_RoomSettings_aliasPlaceholder"
                                         placeholder={ "New alias (e.g. #foo:" + domain + ")" }
                                         blurToCancel={ false }
                                         onValueChanged={ self.onAliasChanged.bind(self, i, j) }
                                         editable={ alias_event && alias_event.getStateKey() === domain }
                                         initialValue={ alias }
                                         />
                                    <div className="mx_RoomSettings_deleteAlias">
                                         { deleteButton }
                                    </div>
                                </div>
                            );
                        });
                    })}

                    <div className="mx_RoomSettings_aliasesTableRow" key="new">
                        <EditableText
                             className="mx_RoomSettings_alias mx_RoomSettings_editable"
                             placeholderClassName="mx_RoomSettings_aliasPlaceholder"
                             placeholder={ "New alias (e.g. #foo:" + domain + ")" }
                             blurToCancel={ false }
                             onValueChanged={ self.onAliasAdded } />
                        <div className="mx_RoomSettings_addAlias">
                             <img src="img/plus.svg" width="14" height="14" alt="Add" onClick={ self.onAliasAdded }/>
                        </div>                        
                    </div>
                </div>
                <div className="mx_RoomSettings_aliasLabel">The canonical entry is&nbsp;
                    <select defaultValue={ canonical_alias }>
                        { alias_events.map(function(alias_event, i) {
                            return alias_event.getContent().aliases.map(function(alias, j) {
                                return <option value={ alias } key={ i + "_" + j }>{ alias }</option>
                            });
                        })}
                        <option value="" key="unset">not set</option>
                    </select>
                </div>
            </div>;

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

        var user_levels_section;
        if (user_levels.length) {
            user_levels_section =
                <div>
                    <div>
                        Users with specific roles are:
                    </div>
                    <div>
                        {Object.keys(user_levels).map(function(user, i) {
                            return (
                                <div className="mx_RoomSettings_userLevel" key={user}>
                                    { user } is a
                                    <PowerSelector value={ user_levels[user] } disabled={true}/>
                                </div>
                            );
                        })}
                    </div>
                </div>;
        }

        var banned = this.props.room.getMembersWithMembership("ban");
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

        var create_event = this.props.room.currentState.getStateEvents('m.room.create', '');
        var unfederatable_section;
        if (create_event.getContent()["m.federate"] === false) {
             unfederatable_section = <div className="mx_RoomSettings_powerLevel">Ths room is not accessible by remote Matrix servers.</div>
        }

        // TODO: support editing custom events_levels
        // TODO: support editing custom user_levels

        return (
            <div className="mx_RoomSettings">
                <label><input type="checkbox" ref="is_private" defaultChecked={join_rule != "public"}/> Make this room private</label> <br/>
                <label><input type="checkbox" ref="share_history" defaultChecked={history_visibility == "shared"}/> Share message history with new users</label> <br/>
                <label><input type="checkbox" ref="guests_read" defaultChecked={history_visibility === "world_readable"}/> Allow guests to read messages in this room</label> <br/>
                <label><input type="checkbox" ref="guests_join" defaultChecked={guest_access === "can_join"}/> Allow guests to join this room</label> <br/>
                <label className="mx_RoomSettings_encrypt"><input type="checkbox" /> Encrypt room</label>

                { room_colors_section }

                { aliases_section }

                <h3>Permissions</h3>
                <div className="mx_RoomSettings_powerLevels mx_RoomSettings_settings">
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">The default role for new room members is </span>
                        <PowerSelector value={default_user_level} disabled={!can_change_levels || current_user_level < default_user_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To send messages, you must be a </span>
                        <PowerSelector value={send_level} disabled={!can_change_levels || current_user_level < send_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To invite users into the room, you must be a </span>
                        <PowerSelector value={invite_level} disabled={!can_change_levels || current_user_level < invite_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To configure the room, you must be a </span>
                        <PowerSelector value={state_level} disabled={!can_change_levels || current_user_level < state_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To kick users, you must be a </span>
                        <PowerSelector value={kick_level} disabled={!can_change_levels || current_user_level < kick_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To ban users, you must be a </span>
                        <PowerSelector value={ban_level} disabled={!can_change_levels || current_user_level < ban_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To redact messages, you must be a </span>
                        <PowerSelector value={redact_level} disabled={!can_change_levels || current_user_level < redact_level} onChange={this.onPowerLevelsChanged}/>
                    </div>

                    {Object.keys(events_levels).map(function(event_type, i) {
                        return (
                            <div className="mx_RoomSettings_powerLevel" key={event_type}>
                                <span className="mx_RoomSettings_powerLevelKey">To send events of type <code>{ event_type }</code>, you must be a </span>
                                <PowerSelector value={ events_levels[event_type] } disabled={true} onChange={this.onPowerLevelsChanged}/>
                            </div>
                        );
                    })}

                { unfederatable_section }                    
                </div>

                <h3>Users</h3>
                <div className="mx_RoomSettings_userLevels mx_RoomSettings_settings">
                    <div>
                        Your role in this room is currently <b><PowerSelector room={ this.props.room } value={current_user_level} disabled={true}/></b>.
                    </div>

                    { user_levels_section }
                </div>

                { banned_users_section }

            </div>
        );
    }
});

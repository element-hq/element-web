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

var React = require('react');
var MatrixClientPeg = require("../../../../src/MatrixClientPeg");

var RoomSettingsController = require("../../../../src/controllers/molecules/RoomSettings");

module.exports = React.createClass({
    displayName: 'RoomSettings',
    mixins: [RoomSettingsController],

    getTopic: function() {
        return this.refs.topic.getDOMNode().value;
    },

    getJoinRules: function() {
        return this.refs.is_private.getDOMNode().checked ? "invite" : "public";
    },

    getHistoryVisibility: function() {
        return this.refs.share_history.getDOMNode().checked ? "shared" : "invited";
    },

    render: function() {
        var topic = this.props.room.currentState.getStateEvents('m.room.topic', '');
        if (topic) topic = topic.getContent().topic;

        var join_rule = this.props.room.currentState.getStateEvents('m.room.join_rules', '');
        if (join_rule) join_rule = join_rule.getContent().join_rule;

        var history_visibility = this.props.room.currentState.getStateEvents('m.room.history_visibility', '');
        if (history_visibility) history_visibility = history_visibility.getContent().history_visibility;

        var power_levels = this.props.room.currentState.getStateEvents('m.room.power_levels', '');
        power_levels = power_levels.getContent();

        var ban_level = parseInt(power_levels.ban);
        var kick_level = parseInt(power_levels.kick);
        var redact_level = parseInt(power_levels.redact);
        var invite_level = parseInt(power_levels.invite);
        var send_level = parseInt(power_levels.events_default);
        var state_level = parseInt(power_levels.state_default);
        var default_user_level = parseInt(power_levels.users_default);

        var user_levels = power_levels.users;

        var user_id = MatrixClientPeg.get().credentials.userId;

        var current_user_level = user_levels[user_id];
        if (current_user_level == undefined) current_user_level = default_user_level;

        var power_level_level = power_levels.events["m.room.power_levels"];
        if (power_level_level == undefined) {
            power_level_level = state_level;
        }

        var can_change_levels = current_user_level >= power_level_level;

        return (
            <div className="mx_RoomSettings">
                <textarea placeholder="Description" defaultValue={topic} ref="topic"/> <br/>
                <label><input type="checkbox" ref="is_private" defaultChecked={join_rule != "public"}/> Make this room private</label> <br/>
                <label><input type="checkbox" ref="share_history" defaultChecked={history_visibility == "shared"}/> Share message history with new users</label> <br/>
                <label><input type="checkbox" /> Encrypt room</label> <br/>

                Power levels:
                <div className="mx_RoomSettings_power_levels">
                    <div>
                        <label htmlFor="mx_RoomSettings_ban_level">Ban level</label>
                        <input type="text" defaultValue={ban_level} size="3" id="mx_RoomSettings_ban_level" disabled={!can_change_levels || current_user_level < ban_level}/>
                    </div>
                    <div>
                        <label htmlFor="mx_RoomSettings_kick_level">Kick level</label>
                        <input type="text" defaultValue={kick_level} size="3" id="mx_RoomSettings_kick_level" disabled={!can_change_levels || current_user_level < kick_level}/>
                    </div>
                    <div>
                        <label htmlFor="mx_RoomSettings_redact_level">Redact level</label>
                        <input type="text" defaultValue={redact_level} size="3" id="mx_RoomSettings_redact_level" disabled={!can_change_levels || current_user_level < redact_level}/>
                    </div>
                    <div>
                        <label htmlFor="mx_RoomSettings_invite_level">Invite level</label>
                        <input type="text" defaultValue={invite_level} size="3" id="mx_RoomSettings_invite_level" disabled={!can_change_levels || current_user_level < invite_level}/>
                    </div>
                    <div>
                        <label htmlFor="mx_RoomSettings_event_level">Send event level</label>
                        <input type="text" defaultValue={send_level} size="3" id="mx_RoomSettings_event_level" disabled={!can_change_levels || current_user_level < send_level}/>
                    </div>
                    <div>
                        <label htmlFor="mx_RoomSettings_state_level">Set state level</label>
                        <input type="text" defaultValue={state_level} size="3" id="mx_RoomSettings_state_level" disabled={!can_change_levels || current_user_level < state_level}/>
                    </div>
                    <div>
                        <label htmlFor="mx_RoomSettings_user_level">Default user level</label>
                        <input type="text" defaultValue={default_user_level} size="3" id="mx_RoomSettings_user_level" disabled={!can_change_levels || current_user_level < default_user_level}/>
                    </div>
                </div>

                User levels:
                <div className="mx_RoomSettings_user_levels">
                    {Object.keys(user_levels).map(function(user, i) {
                        return (
                            <div key={user}>
                                <label htmlFor={"mx_RoomSettings_user_"+i}>{user}</label>
                                <input type="text" defaultValue={user_levels[user]} size="3" id={"mx_RoomSettings_user_"+i} disabled/>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
});

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

var q = require("q");
var React = require('react');
var MatrixClientPeg = require('../../../MatrixClientPeg');
var sdk = require('../../../index');
var Modal = require('../../../Modal');
var ObjectUtils = require("../../../ObjectUtils");

module.exports = React.createClass({
    displayName: 'RoomSettings',

    propTypes: {
        room: React.PropTypes.object.isRequired,
        onSaveClick: React.PropTypes.func,
        onCancelClick: React.PropTypes.func,
    },

    getInitialState: function() {
        var tags = {};
        Object.keys(this.props.room.tags).forEach(function(tagName) {
            tags[tagName] = {};
        });

        var areNotifsMuted = false;
        if (!MatrixClientPeg.get().isGuest()) {
            var roomPushRule = MatrixClientPeg.get().getRoomPushRule("global", this.props.room.roomId);
            if (roomPushRule) {
                if (0 <= roomPushRule.actions.indexOf("dont_notify")) {
                    areNotifsMuted = true;
                }
            }
        }

        return {
            name: this._yankValueFromEvent("m.room.name", "name"),
            topic: this._yankValueFromEvent("m.room.topic", "topic"),
            join_rule: this._yankValueFromEvent("m.room.join_rules", "join_rule"),
            history_visibility: this._yankValueFromEvent("m.room.history_visibility", "history_visibility"),
            guest_access: this._yankValueFromEvent("m.room.guest_access", "guest_access"),
            power_levels_changed: false,
            tags_changed: false,
            tags: tags,
            areNotifsMuted: areNotifsMuted
        };
    },
    
    setName: function(name) {
        this.setState({
            name: name
        });
    },
    
    setTopic: function(topic) {
        this.setState({
            topic: topic
        });
    },
    
    save: function() {
        var stateWasSetDefer = q.defer();
        // the caller may have JUST called setState on stuff, so we need to re-render before saving
        // else we won't use the latest values of things.
        // We can be a bit cheeky here and set a loading flag, and listen for the callback on that
        // to know when things have been set.
        this.setState({ _loading: true}, () => {
            stateWasSetDefer.resolve();
            this.setState({ _loading: false});
        });
        
        return stateWasSetDefer.promise.then(() => {
            return this._save();
        });
    },

    _save: function() {    
        const roomId = this.props.room.roomId;
        var promises = this.saveAliases(); // returns Promise[]
        var originalState = this.getInitialState();

        // diff between original state and this.state to work out what has been changed
        console.log("Original: %s", JSON.stringify(originalState));
        console.log("New: %s", JSON.stringify(this.state));

        // name and topic
        if (this._hasDiff(this.state.name, originalState.name)) {
            promises.push(MatrixClientPeg.get().setRoomName(roomId, this.state.name));
        }
        if (this._hasDiff(this.state.topic, originalState.topic)) {
            promises.push(MatrixClientPeg.get().setRoomTopic(roomId, this.state.topic));
        }

        if (this.state.history_visibility !== originalState.history_visibility) {
            promises.push(MatrixClientPeg.get().sendStateEvent(
                roomId, "m.room.history_visibility",
                { history_visibility: this.state.history_visibility },
                ""
            ));
        }

        if (this.state.join_rule !== originalState.join_rule) {
            promises.push(MatrixClientPeg.get().sendStateEvent(
                roomId, "m.room.join_rules",
                { join_rule: this.state.join_rule },
                ""
            ));
        }

        if (this.state.guest_access !== originalState.guest_access) {
            promises.push(MatrixClientPeg.get().sendStateEvent(
                roomId, "m.room.guest_access",
                { guest_access: this.state.guest_access },
                ""
            ));
        }


        if (this.state.areNotifsMuted !== originalState.areNotifsMuted) {
            promises.push(MatrixClientPeg.get().setRoomMutePushRule(
                "global", roomId, this.state.areNotifsMuted
            ));
        }

        // power levels
        var powerLevels = this._getPowerLevels();
        if (powerLevels) {
            promises.push(MatrixClientPeg.get().sendStateEvent(
                roomId, "m.room.power_levels", powerLevels, ""
            ));
        }

        // tags
        if (this.state.tags_changed) {
            var tagDiffs = ObjectUtils.getKeyValueArrayDiffs(originalState.tags, this.state.tags);
            // [ {place: add, key: "m.favourite", val: "yep"} ]
            tagDiffs.forEach(function(diff) {
                switch (diff.place) {
                    case "add":
                        promises.push(
                            MatrixClientPeg.get().setRoomTag(roomId, diff.key, {})
                        );
                        break;
                    case "del":
                        promises.push(
                            MatrixClientPeg.get().deleteRoomTag(roomId, diff.key)
                        );
                        break;
                    default:
                        console.error("Unknown tag operation: %s", diff.place);
                        break;
                }
            });
        }
        console.log("Performing %s operations", promises.length);

        // color scheme
        promises.push(this.saveColor());
        
        return q.allSettled(promises);
    },

    saveAliases: function() {
        if (!this.refs.alias_settings) { return [q()]; }
        return this.refs.alias_settings.saveSettings();
    },

    saveColor: function() {
        if (!this.refs.color_settings) { return q(); }
        return this.refs.color_settings.saveSettings();
    },

    _hasDiff: function(strA, strB) {
        // treat undefined as an empty string because other components may blindly
        // call setName("") when there has been no diff made to the name!
        strA = strA || "";
        strB = strB || "";
        return strA !== strB;
    },

    _getPowerLevels: function() {
        if (!this.state.power_levels_changed) return undefined;

        var powerLevels = this.props.room.currentState.getStateEvents('m.room.power_levels', '');
        powerLevels = powerLevels ? powerLevels.getContent() : {};

        var newPowerLevels = {
            ban: parseInt(this.refs.ban.getValue()),
            kick: parseInt(this.refs.kick.getValue()),
            redact: parseInt(this.refs.redact.getValue()),
            invite: parseInt(this.refs.invite.getValue()),
            events_default: parseInt(this.refs.events_default.getValue()),
            state_default: parseInt(this.refs.state_default.getValue()),
            users_default: parseInt(this.refs.users_default.getValue()),
            users: powerLevels.users,
            events: powerLevels.events,
        };

        return newPowerLevels;
    },

    onPowerLevelsChanged: function() {
        this.setState({
            power_levels_changed: true
        });
    },
    
    _yankValueFromEvent: function(stateEventType, keyName, defaultValue) {
        // E.g.("m.room.name","name") would yank the "name" content key from "m.room.name"
        var event = this.props.room.currentState.getStateEvents(stateEventType, '');
        if (!event) {
            return defaultValue;
        }
        return event.getContent()[keyName] || defaultValue;
    },

    _onHistoryRadioToggle: function(ev) {
        this.setState({
            history_visibility: ev.target.value
        });
    },
    
    _onToggle: function(keyName, checkedValue, uncheckedValue, ev) {
        console.log("Checkbox toggle: %s %s", keyName, ev.target.checked);
        var state = {};
        state[keyName] = ev.target.checked ? checkedValue : uncheckedValue;
        this.setState(state);
    },

    _onTagChange: function(tagName, event) {
        if (event.target.checked) {
            if (tagName === 'm.favourite') {
                delete this.state.tags['m.lowpriority'];
            }
            else if (tagName === 'm.lowpriority') {
                delete this.state.tags['m.favourite'];
            }

            this.state.tags[tagName] = this.state.tags[tagName] || ["yep"];
        }
        else {
            delete this.state.tags[tagName];
        }

        this.setState({
            tags: this.state.tags,
            tags_changed: true
        });
    },

    render: function() {
        // TODO: go through greying out things you don't have permission to change
        // (or turning them into informative stuff)

        var AliasSettings = sdk.getComponent("room_settings.AliasSettings");
        var ColorSettings = sdk.getComponent("room_settings.ColorSettings");
        var EditableText = sdk.getComponent('elements.EditableText');
        var PowerSelector = sdk.getComponent('elements.PowerSelector');

        var power_levels = this.props.room.currentState.getStateEvents('m.room.power_levels', '');
        var events_levels = (power_levels ? power_levels.events : {}) || {};
        var user_id = MatrixClientPeg.get().credentials.userId;

        if (power_levels) {
            power_levels = power_levels.getContent();

            var ban_level = parseInt(power_levels.ban);
            var kick_level = parseInt(power_levels.kick);
            var redact_level = parseInt(power_levels.redact);
            var invite_level = parseInt(power_levels.invite || 0);
            var send_level = parseInt(power_levels.events_default || 0);
            var state_level = parseInt(power_levels.state_default || 50);
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

        var state_default = (parseInt(power_levels ? power_levels.state_default : 0) || 0);

        var room_aliases_level = state_default;
        if (events_levels['m.room.aliases'] !== undefined) {
            room_aliases_level = events_levels['m.room.aliases'];
        }
        var can_set_room_aliases = current_user_level >= room_aliases_level;

        var canonical_alias_level = state_default;
        if (events_levels['m.room.canonical_alias'] !== undefined) {
            canonical_alias_level = events_levels['m.room.canonical_alias'];
        }
        var canSetCanonicalAlias = current_user_level >= canonical_alias_level;
        var canSetTag = true;

        var self = this;

        var userLevelsSection;
        if (Object.keys(user_levels).length) {
            userLevelsSection =
                <div>
                    <h3>Privileged Users</h3>
                    <ul className="mx_RoomSettings_userLevels">
                        {Object.keys(user_levels).map(function(user, i) {
                            return (
                                <li className="mx_RoomSettings_userLevel" key={user}>
                                    { user } is a <PowerSelector value={ user_levels[user] } disabled={true}/>
                                </li>
                            );
                        })}
                    </ul>
                </div>;
        }
        else {
            userLevelsSection = <div>No users have specific privileges in this room.</div>
        }

        var banned = this.props.room.getMembersWithMembership("ban");
        var bannedUsersSection;
        if (banned.length) {
            bannedUsersSection =
                <div>
                    <h3>Banned users</h3>
                    <ul className="mx_RoomSettings_banned">
                        {banned.map(function(member, i) {
                            return (
                                <li key={i}>
                                    {member.userId}
                                </li>
                            );
                        })}
                    </ul>
                </div>;
        }

        var unfederatableSection;
        if (this._yankValueFromEvent("m.room.create", "m.federate") === false) {
             unfederatableSection = (
                <div className="mx_RoomSettings_powerLevel">
                Ths room is not accessible by remote Matrix servers.
                </div>
            );
        }

        // TODO: support editing custom events_levels
        // TODO: support editing custom user_levels

        var tags = [
            { name: "m.favourite", label: "Favourite", ref: "tag_favourite" },
            { name: "m.lowpriority", label: "Low priority", ref: "tag_lowpriority" },
        ];

        Object.keys(this.state.tags).sort().forEach(function(tagName) {
            if (tagName !== 'm.favourite' && tagName !== 'm.lowpriority') {
                tags.push({ name: tagName, label: tagName });
            }
        });

        var tagsSection = 
            <div className="mx_RoomSettings_tags">
                Tagged as:
                { canSetTag ?
                    tags.map(function(tag, i) {
                        return (<label key={ i }>
                                    <input type="checkbox"
                                           ref={ tag.ref }
                                           checked={ tag.name in self.state.tags }
                                           onChange={ self._onTagChange.bind(self, tag.name) }/>
                                    { tag.label }
                                </label>);
                    }) : tags.map(function(tag) { return tag.label; }).join(", ")
                }
            </div>

        // If there is no history_visibility, it is assumed to be 'shared'.
        // http://matrix.org/docs/spec/r0.0.0/client_server.html#id31
        var historyVisibility = this.state.history_visibility || "shared";

        // FIXME: disable guests_read if the user hasn't turned on shared history
        return (
            <div className="mx_RoomSettings">

                { tagsSection }

                <div className="mx_RoomSettings_toggles">
                    <label>
                        <input type="checkbox" onChange={this._onToggle.bind(this, "areNotifsMuted", true, false)} defaultChecked={this.state.areNotifsMuted}/>
                        Mute notifications for this room
                    </label>
                    <label>
                        <input type="checkbox" onChange={this._onToggle.bind(this, "join_rule", "invite", "public")}
                            defaultChecked={this.state.join_rule !== "public"}/>
                        Make this room private
                    </label>
                    <label>
                        <input type="checkbox" onChange={this._onToggle.bind(this, "guest_access", "can_join", "forbidden")}
                            defaultChecked={this.state.guest_access === "can_join"}/>
                        Let guests join this room
                    </label>
                    <div className="mx_RoomSettings_settings">
                        <h3>Who can read history?</h3>
                        <label htmlFor="hvis_wr">
                            <input type="radio" id="hvis_wr" name="historyVis" value="world_readable"
                                    defaultChecked={historyVisibility === "world_readable"}
                                    onChange={this._onHistoryRadioToggle} />
                            Anyone
                        </label>
                        <label htmlFor="hvis_sh">
                            <input type="radio" id="hvis_sh" name="historyVis" value="shared"
                                    defaultChecked={historyVisibility === "shared"}
                                    onChange={this._onHistoryRadioToggle} />
                            Members only (since the room began)
                        </label>
                        <label htmlFor="hvis_inv">
                            <input type="radio" id="hvis_inv" name="historyVis" value="invited"
                                    defaultChecked={historyVisibility === "invited"}
                                    onChange={this._onHistoryRadioToggle} />
                            Members only (since they were invited)
                        </label>
                        <label htmlFor="hvis_joi">
                            <input type="radio" id="hvis_joi" name="historyVis" value="joined"
                                    defaultChecked={historyVisibility === "joined"}
                                    onChange={this._onHistoryRadioToggle} />
                            Members only (since they joined)
                        </label>
                    </div>
                    <label className="mx_RoomSettings_encrypt">
                        <input type="checkbox" />
                        Encrypt room
                    </label>
                </div>


                <div>
                    <h3>Room Colour</h3>
                    <ColorSettings ref="color_settings" room={this.props.room} />
                </div>

                <AliasSettings ref="alias_settings"
                    roomId={this.props.room.roomId}
                    canSetCanonicalAlias={canSetCanonicalAlias}
                    canSetAliases={can_set_room_aliases}
                    canonicalAliasEvent={this.props.room.currentState.getStateEvents('m.room.canonical_alias', '')}
                    aliasEvents={this.props.room.currentState.getStateEvents('m.room.aliases')} />

                <h3>Permissions</h3>
                <div className="mx_RoomSettings_powerLevels mx_RoomSettings_settings">
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">The default role for new room members is </span>
                        <PowerSelector ref="users_default" value={default_user_level} disabled={!can_change_levels || current_user_level < default_user_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To send messages, you must be a </span>
                        <PowerSelector ref="events_default" value={send_level} disabled={!can_change_levels || current_user_level < send_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To invite users into the room, you must be a </span>
                        <PowerSelector ref="invite" value={invite_level} disabled={!can_change_levels || current_user_level < invite_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To configure the room, you must be a </span>
                        <PowerSelector ref="state_default" value={state_level} disabled={!can_change_levels || current_user_level < state_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To kick users, you must be a </span>
                        <PowerSelector ref="kick" value={kick_level} disabled={!can_change_levels || current_user_level < kick_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To ban users, you must be a </span>
                        <PowerSelector ref="ban" value={ban_level} disabled={!can_change_levels || current_user_level < ban_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To redact messages, you must be a </span>
                        <PowerSelector ref="redact" value={redact_level} disabled={!can_change_levels || current_user_level < redact_level} onChange={this.onPowerLevelsChanged}/>
                    </div>

                    {Object.keys(events_levels).map(function(event_type, i) {
                        return (
                            <div className="mx_RoomSettings_powerLevel" key={event_type}>
                                <span className="mx_RoomSettings_powerLevelKey">To send events of type <code>{ event_type }</code>, you must be a </span>
                                <PowerSelector value={ events_levels[event_type] } disabled={true} onChange={self.onPowerLevelsChanged}/>
                            </div>
                        );
                    })}

                { unfederatableSection }
                </div>

                { userLevelsSection }

                { bannedUsersSection }

                <h3>Advanced</h3>
                <div className="mx_RoomSettings_settings">
                    This room's internal ID is <code>{ this.props.room.roomId }</code>
                </div>

            </div>
        );
    }
});

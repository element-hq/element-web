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
var Modal = require('../../../Modal');

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
        onSaveClick: React.PropTypes.func,
        onCancelClick: React.PropTypes.func,
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

        // get the aliases
        var aliases = {};
        var domain = MatrixClientPeg.get().getDomain();
        var alias_events = this.props.room.currentState.getStateEvents('m.room.aliases');
        for (var i = 0; i < alias_events.length; i++) {
            aliases[alias_events[i].getStateKey()] = alias_events[i].getContent().aliases.slice(); // shallow copy
        }
        aliases[domain] = aliases[domain] || [];

        var tags = {};
        Object.keys(this.props.room.tags).forEach(function(tagName) {
            tags[tagName] = {};
        });

        return {
            power_levels_changed: false,
            color_scheme_changed: false,
            color_scheme_index: room_color_index,
            aliases_changed: false,
            aliases: aliases,
            tags_changed: false,
            tags: tags,
        };
    },

    resetState: function() {
        this.set.state(this.getInitialState());
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

    areNotificationsMuted: function() {
        return this.refs.are_notifications_muted.checked;
    },

    getPowerLevels: function() {
        if (!this.state.power_levels_changed) return undefined;

        var power_levels = this.props.room.currentState.getStateEvents('m.room.power_levels', '');
        power_levels = power_levels.getContent();

        var new_power_levels = {
            ban: parseInt(this.refs.ban.getValue()),
            kick: parseInt(this.refs.kick.getValue()),
            redact: parseInt(this.refs.redact.getValue()),
            invite: parseInt(this.refs.invite.getValue()),
            events_default: parseInt(this.refs.events_default.getValue()),
            state_default: parseInt(this.refs.state_default.getValue()),
            users_default: parseInt(this.refs.users_default.getValue()),
            users: power_levels.users,
            events: power_levels.events,
        };

        return new_power_levels;
    },

    getCanonicalAlias: function() {
        return this.refs.canonical_alias ? this.refs.canonical_alias.value : "";        
    },

    getAliasOperations: function() {
        if (!this.state.aliases_changed) return undefined;

        // work out the delta from room state to UI state
        var ops = [];

        // calculate original ("old") aliases
        var oldAliases = {};
        var aliases = this.state.aliases;
        var alias_events = this.props.room.currentState.getStateEvents('m.room.aliases');
        for (var i = 0; i < alias_events.length; i++) {
            var domain = alias_events[i].getStateKey();
            oldAliases[domain] = alias_events[i].getContent().aliases.slice(); // shallow copy
        }

        // FIXME: this whole delta-based set comparison function used for domains, aliases & tags
        // should be factored out asap rather than duplicated like this.

        // work out whether any domains have entirely disappeared or appeared
        var domainDelta = {}
        Object.keys(oldAliases).forEach(function(domain) {
            domainDelta[domain] = domainDelta[domain] || 0;
            domainDelta[domain]--;
        });
        Object.keys(aliases).forEach(function(domain) {
            domainDelta[domain] = domainDelta[domain] || 0;
            domainDelta[domain]++;
        });

        Object.keys(domainDelta).forEach(function(domain) {
            switch (domainDelta[domain]) {
                case 1: // entirely new domain
                    aliases[domain].forEach(function(alias) {
                        ops.push({ type: "put", alias : alias });
                    });
                    break;
                case -1: // entirely removed domain
                    oldAliases[domain].forEach(function(alias) {
                        ops.push({ type: "delete", alias : alias });
                    });
                    break;
                case 0: // mix of aliases in this domain.
                    // compare old & new aliases for this domain
                    var delta = {};
                    oldAliases[domain].forEach(function(item) {
                        delta[item] = delta[item] || 0;
                        delta[item]--;
                    });
                    aliases[domain].forEach(function(item) {
                        delta[item] = delta[item] || 0;
                        delta[item]++;
                    });

                    Object.keys(delta).forEach(function(alias) {
                        if (delta[alias] == 1) {
                            ops.push({ type: "put", alias: alias });
                        } else if (delta[alias] == -1) {
                            ops.push({ type: "delete", alias: alias });
                        } else {
                            console.error("Calculated alias delta of " + delta[alias] +
                                          " - this should never happen!");                            
                        }
                    });
                    break;
                default:
                    console.error("Calculated domain delta of " + domainDelta[domain] +
                                  " - this should never happen!");
                    break;
            }
        });

        return ops;
    },

    getTagOperations: function() {
        if (!this.state.tags_changed) return undefined;

        var ops = [];

        var delta = {};
        Object.keys(this.props.room.tags).forEach(function(oldTag) {
            delta[oldTag] = delta[oldTag] || 0;
            delta[oldTag]--;
        });
        Object.keys(this.state.tags).forEach(function(newTag) {
            delta[newTag] = delta[newTag] || 0;
            delta[newTag]++;
        });
        Object.keys(delta).forEach(function(tag) {
            if (delta[tag] == 1) {
                ops.push({ type: "put", tag: tag });
            } else if (delta[tag] == -1) {
                ops.push({ type: "delete", tag: tag });
            } else {
                console.error("Calculated tag delta of " + delta[tag] +
                              " - this should never happen!");
            }
        });

        return ops;
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

    onAliasChanged: function(domain, index, alias) {
        if (alias === "") return; // hit the delete button to delete please
        var oldAlias;
        if (this.isAliasValid(alias)) {
            oldAlias = this.state.aliases[domain][index];
            this.state.aliases[domain][index] = alias;
            this.setState({ aliases_changed : true });
        }
        else {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");            
            Modal.createDialog(ErrorDialog, {
                title: "Invalid address format", 
                description: "'" + alias + "' is not a valid format for an address",
            });
        }        
    },

    onAliasDeleted: function(domain, index) {
        // It's a bit naughty to directly manipulate this.state, and React would
        // normally whine at you, but it can't see us doing the splice.  Given we
        // promptly setState anyway, it's just about acceptable.  The alternative
        // would be to arbitrarily deepcopy to a temp variable and then setState
        // that, but why bother when we can cut this corner.
        var alias = this.state.aliases[domain].splice(index, 1);
        this.setState({ 
            aliases: this.state.aliases
        });

        this.setState({ aliases_changed : true });
    },

    onAliasAdded: function(alias) {
        if (alias === "") return; // ignore attempts to create blank aliases
        if (alias === undefined) {
            alias = this.refs.add_alias ? this.refs.add_alias.getValue() : undefined;
            if (alias === undefined || alias === "") return;
        }

        if (this.isAliasValid(alias)) {
            var domain = alias.replace(/^.*?:/, '');
            // XXX: do we need to deep copy aliases before editing it?
            this.state.aliases[domain] = this.state.aliases[domain] || [];
            this.state.aliases[domain].push(alias);
            this.setState({ 
                aliases: this.state.aliases
            });

            // reset the add field
            this.refs.add_alias.setValue('');

            this.setState({ aliases_changed : true });
        }
        else {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");            
            Modal.createDialog(ErrorDialog, {
                title: "Invalid alias format", 
                description: "'" + alias + "' is not a valid format for an alias",
            });
        }
    },

    isAliasValid: function(alias) {
        // XXX: FIXME SPEC-1
        return (alias.match(/^#([^\/:,]+?):(.+)$/) && encodeURI(alias) === alias);
    },

    onTagChange: function(tagName, event) {
        if (event.target.checked) {
            if (tagName === 'm.favourite') {
                delete this.state.tags['m.lowpriority'];
            }
            else if (tagName === 'm.lowpriority') {
                delete this.state.tags['m.favourite'];
            }

            this.state.tags[tagName] = this.state.tags[tagName] || {};
        }
        else {
            delete this.state.tags[tagName];
        }

        // XXX: hacky say to deep-edit state
        this.setState({
            tags: this.state.tags,
            tags_changed: true
        });
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

        var are_notifications_muted;
        var roomPushRule = MatrixClientPeg.get().getRoomPushRule("global", this.props.room.roomId); 
        if (roomPushRule) {
            if (0 <= roomPushRule.actions.indexOf("dont_notify")) {
                are_notifications_muted = true;
            }
        }

        var events_levels = (power_levels ? power_levels.events : {}) || {};

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

        var state_default = (parseInt(power_levels ? power_levels.state_default : 0) || 0);

        var room_aliases_level = state_default;
        if (events_levels['m.room.aliases'] !== undefined) {
            room_avatar_level = events_levels['m.room.aliases'];
        }
        var can_set_room_aliases = current_user_level >= room_aliases_level;

        var canonical_alias_level = state_default;
        if (events_levels['m.room.canonical_alias'] !== undefined) {
            room_avatar_level = events_levels['m.room.canonical_alias'];
        }
        var can_set_canonical_alias = current_user_level >= canonical_alias_level;

        var can_set_tag = true;

        var self = this;

        var canonical_alias_event = this.props.room.currentState.getStateEvents('m.room.canonical_alias', '');
        var canonical_alias = canonical_alias_event ? canonical_alias_event.getContent().alias : "";
        var domain = MatrixClientPeg.get().getDomain();

        var remote_domains = Object.keys(this.state.aliases).filter(function(alias) { return alias !== domain });

        var remote_aliases_section;
        if (remote_domains.length) {
            remote_aliases_section = 
                <div>
                    <div className="mx_RoomSettings_aliasLabel">
                        Remote addresses for this room:
                    </div>
                    <div className="mx_RoomSettings_aliasesTable">
                        { remote_domains.map(function(state_key, i) {
                            return self.state.aliases[state_key].map(function(alias, j) {
                                return (
                                    <div className="mx_RoomSettings_aliasesTableRow" key={ i + "_" + j }>
                                        <EditableText
                                             className="mx_RoomSettings_alias mx_RoomSettings_editable"
                                             blurToCancel={ false }
                                             editable={ false }
                                             initialValue={ alias } />
                                    </div>
                                );
                            });
                        })}
                    </div>
                </div>
        }

        var canonical_alias_section;
        if (can_set_canonical_alias) {
            canonical_alias_section = 
                <select ref="canonical_alias" defaultValue={ canonical_alias }>
                    { Object.keys(self.state.aliases).map(function(stateKey, i) {
                        return self.state.aliases[stateKey].map(function(alias, j) {
                            return <option value={ alias } key={ i + "_" + j }>{ alias }</option>
                        });
                    })}
                    <option value="" key="unset">not specified</option>
                </select>
        }
        else {
            canonical_alias_section = <b>{ canonical_alias || "not set" }</b>;
        }

        var aliases_section =
            <div>
                <h3>Addresses</h3>
                <div className="mx_RoomSettings_aliasLabel">The main address for this room is: { canonical_alias_section }</div>
                <div className="mx_RoomSettings_aliasLabel">
                    { this.state.aliases[domain].length
                      ? "Local addresses for this room:"
                      : "This room has no local addresses" }
                </div>
                <div className="mx_RoomSettings_aliasesTable">
                    { this.state.aliases[domain].map(function(alias, i) {
                        var deleteButton;
                        if (can_set_room_aliases) {
                            deleteButton = <img src="img/cancel-small.svg" width="14" height="14" alt="Delete"
                                                onClick={ self.onAliasDeleted.bind(self, domain, i) }/>;
                        }
                        return (
                            <div className="mx_RoomSettings_aliasesTableRow" key={ i }>
                                <EditableText
                                    className="mx_RoomSettings_alias mx_RoomSettings_editable"
                                    placeholderClassName="mx_RoomSettings_aliasPlaceholder"
                                    placeholder={ "New address (e.g. #foo:" + domain + ")" }
                                    blurToCancel={ false }
                                    onValueChanged={ self.onAliasChanged.bind(self, domain, i) }
                                    editable={ can_set_room_aliases }
                                    initialValue={ alias } />
                                <div className="mx_RoomSettings_deleteAlias">
                                     { deleteButton }
                                </div>
                            </div>
                        );
                    })}

                    <div className="mx_RoomSettings_aliasesTableRow" key="new">
                        <EditableText
                            ref="add_alias"
                            className="mx_RoomSettings_alias mx_RoomSettings_editable"
                            placeholderClassName="mx_RoomSettings_aliasPlaceholder"
                            placeholder={ "New address (e.g. #foo:" + domain + ")" }
                            blurToCancel={ false }
                            onValueChanged={ self.onAliasAdded } />
                        <div className="mx_RoomSettings_addAlias">
                             <img src="img/plus.svg" width="14" height="14" alt="Add"
                                  onClick={ self.onAliasAdded.bind(self, undefined) }/>
                        </div>                        
                    </div>                      
                </div>

                { remote_aliases_section }

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
        if (Object.keys(user_levels).length) {
            user_levels_section =
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
            user_levels_section = <div>No users have specific privileges in this room.</div>
        }

        var banned = this.props.room.getMembersWithMembership("ban");
        var banned_users_section;
        if (banned.length) {
            banned_users_section =
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

        var create_event = this.props.room.currentState.getStateEvents('m.room.create', '');
        var unfederatable_section;
        if (create_event.getContent()["m.federate"] === false) {
             unfederatable_section = <div className="mx_RoomSettings_powerLevel">Ths room is not accessible by remote Matrix servers.</div>
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

        var tags_section = 
            <div className="mx_RoomSettings_tags">
                Tagged as:
                { can_set_tag ?
                    tags.map(function(tag, i) {
                        return (<label key={ i }>
                                    <input type="checkbox"
                                           ref={ tag.ref }
                                           checked={ tag.name in self.state.tags }
                                           onChange={ self.onTagChange.bind(self, tag.name) }/>
                                    { tag.label }
                                </label>);
                    }) : tags.map(function(tag) { return tag.label; }).join(", ")
                }
            </div>

        // FIXME: disable guests_read if the user hasn't turned on shared history
        return (
            <div className="mx_RoomSettings">

                { tags_section }

                <div className="mx_RoomSettings_toggles">
                    <label><input type="checkbox" ref="are_notifications_muted" defaultChecked={are_notifications_muted}/> Mute notifications for this room</label>
                    <label><input type="checkbox" ref="is_private" defaultChecked={join_rule != "public"}/> Make this room private</label>
                    <label><input type="checkbox" ref="share_history" defaultChecked={history_visibility === "shared" || history_visibility === "world_readable"}/> Share message history with new participants</label>
                    <label><input type="checkbox" ref="guests_join" defaultChecked={guest_access === "can_join"}/> Let guests join this room</label>
                    <label><input type="checkbox" ref="guests_read" defaultChecked={history_visibility === "world_readable"}/> Let users read message history without joining</label>
                    <label className="mx_RoomSettings_encrypt"><input type="checkbox" /> Encrypt room</label>
                </div>


                { room_colors_section }

                { aliases_section }

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

                { unfederatable_section }                    
                </div>

                { user_levels_section }

                { banned_users_section }

                <h3>Advanced</h3>
                <div className="mx_RoomSettings_settings">
                    This room's internal ID is <code>{ this.props.room.roomId }</code>
                </div>

            </div>
        );
    }
});

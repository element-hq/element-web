/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd

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

import q from 'q';
import React from 'react';
import MatrixClientPeg from '../../../MatrixClientPeg';
import SdkConfig from '../../../SdkConfig';
import sdk from '../../../index';
import Modal from '../../../Modal';
import ObjectUtils from '../../../ObjectUtils';
import dis from '../../../dispatcher';
import ScalarAuthClient from '../../../ScalarAuthClient';
import ScalarMessaging from '../../../ScalarMessaging';
import UserSettingsStore from '../../../UserSettingsStore';
import AccessibleButton from '../elements/AccessibleButton';


// parse a string as an integer; if the input is undefined, or cannot be parsed
// as an integer, return a default.
function parseIntWithDefault(val, def) {
    var res = parseInt(val);
    return isNaN(res) ? def : res;
}

const BannedUser = React.createClass({
    propTypes: {
        member: React.PropTypes.object.isRequired, // js-sdk RoomMember
    },

    _onUnbanClick: function() {
        const ConfirmUserActionDialog = sdk.getComponent("dialogs.ConfirmUserActionDialog");
        Modal.createDialog(ConfirmUserActionDialog, {
            member: this.props.member,
            action: 'Unban',
            danger: false,
            onFinished: (proceed) => {
                if (!proceed) return;

                MatrixClientPeg.get().unban(
                    this.props.member.roomId, this.props.member.userId,
                ).catch((err) => {
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    console.error("Failed to unban: " + err);
                    Modal.createDialog(ErrorDialog, {
                        title: "Error",
                        description: "Failed to unban",
                    });
                }).done();
            },
        });
    },

    render: function() {
        return (
            <li>
                <AccessibleButton className="mx_RoomSettings_unbanButton"
                    onClick={this._onUnbanClick}
                >
                    Unban
                </AccessibleButton>
                {this.props.member.userId}
            </li>
        );
    }
});

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
            tags[tagName] = ['yep'];
        });

        return {
            name: this._yankValueFromEvent("m.room.name", "name"),
            topic: this._yankValueFromEvent("m.room.topic", "topic"),
            join_rule: this._yankValueFromEvent("m.room.join_rules", "join_rule"),
            history_visibility: this._yankValueFromEvent("m.room.history_visibility", "history_visibility"),
            guest_access: this._yankValueFromEvent("m.room.guest_access", "guest_access"),
            power_levels_changed: false,
            tags_changed: false,
            tags: tags,
            // isRoomPublished is loaded async in componentWillMount so when the component
            // inits, the saved value will always be undefined, however getInitialState()
            // is also called from the saving code so we must return the correct value here
            // if we have it (although this could race if the user saves before we load whether
            // the room is published or not).
            // Default to false if it's undefined, otherwise react complains about changing
            // components from uncontrolled to controlled
            isRoomPublished: this._originalIsRoomPublished || false,
            scalar_error: null,
            showIntegrationsError: false,
        };
    },

    componentWillMount: function() {
        ScalarMessaging.startListening();

        MatrixClientPeg.get().on("RoomMember.membership", this._onRoomMemberMembership);

        MatrixClientPeg.get().getRoomDirectoryVisibility(
            this.props.room.roomId
        ).done((result) => {
            this.setState({ isRoomPublished: result.visibility === "public" });
            this._originalIsRoomPublished = result.visibility === "public";
        }, (err) => {
            console.error("Failed to get room visibility: " + err);
        });

        this.scalarClient = new ScalarAuthClient();
        this.scalarClient.connect().done(() => {
            this.forceUpdate();
        }, (err) => {
            this.setState({
                scalar_error: err
            });
        });

        dis.dispatch({
            action: 'ui_opacity',
            sideOpacity: 0.3,
            middleOpacity: 0.3,
        });
    },

    componentWillUnmount: function() {
        ScalarMessaging.stopListening();

        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener("RoomMember.membership", this._onRoomMemberMembership);
        }

        dis.dispatch({
            action: 'ui_opacity',
            sideOpacity: 1.0,
            middleOpacity: 1.0,
        });
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
            return q.allSettled(this._calcSavePromises());
        });
    },

    _calcSavePromises: function() {
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

        if (this.state.isRoomPublished !== originalState.isRoomPublished) {
            promises.push(MatrixClientPeg.get().setRoomDirectoryVisibility(
                roomId,
                this.state.isRoomPublished ? "public" : "private"
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
            // [ {place: add, key: "m.favourite", val: ["yep"]} ]
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

        // color scheme
        var p;
        p = this.saveColor();
        if (!q.isFulfilled(p)) {
            promises.push(p);
        }

        // url preview settings
        var ps = this.saveUrlPreviewSettings();
        if (ps.length > 0) {
            promises.push(ps);
        }

        // encryption
        p = this.saveEnableEncryption();
        if (!q.isFulfilled(p)) {
            promises.push(p);
        }

        this.saveBlacklistUnverifiedDevicesPerRoom();

        console.log("Performing %s operations: %s", promises.length, JSON.stringify(promises));
        return promises;
    },

    saveAliases: function() {
        if (!this.refs.alias_settings) { return [q()]; }
        return this.refs.alias_settings.saveSettings();
    },

    saveColor: function() {
        if (!this.refs.color_settings) { return q(); }
        return this.refs.color_settings.saveSettings();
    },

    saveUrlPreviewSettings: function() {
        if (!this.refs.url_preview_settings) { return q(); }
        return this.refs.url_preview_settings.saveSettings();
    },

    saveEnableEncryption: function() {
        if (!this.refs.encrypt) { return q(); }

        var encrypt = this.refs.encrypt.checked;
        if (!encrypt) { return q(); }

        var roomId = this.props.room.roomId;
        return MatrixClientPeg.get().sendStateEvent(
            roomId, "m.room.encryption",
            { algorithm: "m.megolm.v1.aes-sha2" }
        );
    },

    saveBlacklistUnverifiedDevicesPerRoom: function() {
        if (!this.refs.blacklistUnverified) return;
        if (this._isRoomBlacklistUnverified() !== this.refs.blacklistUnverified.checked) {
            this._setRoomBlacklistUnverified(this.refs.blacklistUnverified.checked);
        }
    },

    _isRoomBlacklistUnverified: function() {
        var blacklistUnverifiedDevicesPerRoom = UserSettingsStore.getLocalSettings().blacklistUnverifiedDevicesPerRoom;
        if (blacklistUnverifiedDevicesPerRoom) {
            return blacklistUnverifiedDevicesPerRoom[this.props.room.roomId];
        }
        return false;
    },

    _setRoomBlacklistUnverified: function(value) {
        var blacklistUnverifiedDevicesPerRoom = UserSettingsStore.getLocalSettings().blacklistUnverifiedDevicesPerRoom || {};
        blacklistUnverifiedDevicesPerRoom[this.props.room.roomId] = value;
        UserSettingsStore.setLocalSetting('blacklistUnverifiedDevicesPerRoom', blacklistUnverifiedDevicesPerRoom);

        this.props.room.setBlacklistUnverifiedDevices(value);
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
        var self = this;
        var QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");

        // cancel the click unless the user confirms it
        ev.preventDefault();
        var value = ev.target.value;

        Modal.createDialog(QuestionDialog, {
            title: "Privacy warning",
            description:
                <div>
                    Changes to who can read history will only apply to future messages in this room.<br/>
                    The visibility of existing history will be unchanged.
                </div>,
            button: "Continue",
            onFinished: function(confirmed) {
                if (confirmed) {
                    self.setState({
                        history_visibility: value
                    });
                }
            },
        });
    },

    _onRoomAccessRadioToggle: function(ev) {

        //                         join_rule
        //                      INVITE  |  PUBLIC
        //        ----------------------+----------------
        // guest  CAN_JOIN   | inv_only | pub_with_guest
        // access ----------------------+----------------
        //        FORBIDDEN  | inv_only | pub_no_guest
        //        ----------------------+----------------

        switch (ev.target.value) {
            case "invite_only":
                this.setState({
                    join_rule: "invite",
                    // we always set guests can_join here as it makes no sense to have
                    // an invite-only room that guests can't join.  If you explicitly
                    // invite them, you clearly want them to join, whether they're a
                    // guest or not.  In practice, guest_access should probably have
                    // been implemented as part of the join_rules enum.
                    guest_access: "can_join",
                });
                break;
            case "public_no_guests":
                this.setState({
                    join_rule: "public",
                    guest_access: "forbidden",
                });
                break;
            case "public_with_guests":
                this.setState({
                    join_rule: "public",
                    guest_access: "can_join",
                });
                break;
        }
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

    mayChangeRoomAccess: function() {
        var cli = MatrixClientPeg.get();
        var roomState = this.props.room.currentState;
        return (roomState.mayClientSendStateEvent("m.room.join_rules", cli) &&
                roomState.mayClientSendStateEvent("m.room.guest_access", cli));
    },

    onManageIntegrations(ev) {
        ev.preventDefault();
        var IntegrationsManager = sdk.getComponent("views.settings.IntegrationsManager");
        Modal.createDialog(IntegrationsManager, {
            src: this.scalarClient.hasCredentials() ?
                    this.scalarClient.getScalarInterfaceUrlForRoom(this.props.room.roomId) :
                    null,
            onFinished: ()=>{
                if (this._calcSavePromises().length === 0) {
                    this.props.onCancelClick(ev);
                }
            },
        }, "mx_IntegrationsManager");
    },

    onShowIntegrationsError(ev) {
        ev.preventDefault();
        this.setState({
            showIntegrationsError: !this.state.showIntegrationsError,
        });
    },

    onLeaveClick() {
        dis.dispatch({
            action: 'leave_room',
            room_id: this.props.room.roomId,
        });
    },

    onForgetClick() {
        // FIXME: duplicated with RoomTagContextualMenu (and dead code in RoomView)
        MatrixClientPeg.get().forget(this.props.room.roomId).done(function() {
            dis.dispatch({ action: 'view_next_room' });
        }, function(err) {
            var errCode = err.errcode || "unknown error code";
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Error",
                description: `Failed to forget room (${errCode})`
            });
        });
    },

    onEnableEncryptionClick() {
        if (!this.refs.encrypt.checked) return;

        var QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        Modal.createDialog(QuestionDialog, {
            title: "Warning!",
            description: (
                <div>
                    <p>End-to-end encryption is in beta and may not be reliable.</p>
                    <p>You should <b>not</b> yet trust it to secure data.</p>
                    <p>Devices will <b>not</b> yet be able to decrypt history from before they joined the room.</p>
                    <p>Once encryption is enabled for a room it <b>cannot</b> be turned off again (for now).</p>
                    <p>Encrypted messages will not be visible on clients that do not yet implement encryption.</p>
                </div>
            ),
            onFinished: confirm=>{
                if (!confirm) {
                    this.refs.encrypt.checked = false;
                }
            },
        });
    },

    _onRoomMemberMembership: function() {
        // Update, since our banned user list may have changed
        this.forceUpdate();
    },

    _renderEncryptionSection: function() {
        var cli = MatrixClientPeg.get();
        var roomState = this.props.room.currentState;
        var isEncrypted = cli.isRoomEncrypted(this.props.room.roomId);
        var isGlobalBlacklistUnverified = UserSettingsStore.getLocalSettings().blacklistUnverifiedDevices;
        var isRoomBlacklistUnverified = this._isRoomBlacklistUnverified();

        var settings =
            <label>
                <input type="checkbox" ref="blacklistUnverified"
                       defaultChecked={ isGlobalBlacklistUnverified || isRoomBlacklistUnverified }
                       disabled={ isGlobalBlacklistUnverified || (this.refs.encrypt && !this.refs.encrypt.checked) }/>
                Never send encrypted messages to unverified devices in this room from this device.
            </label>;

        if (!isEncrypted &&
                roomState.mayClientSendStateEvent("m.room.encryption", cli)) {
            return (
                <div>
                    <label>
                        <input type="checkbox" ref="encrypt" onClick={ this.onEnableEncryptionClick }/>
                        <img className="mx_RoomSettings_e2eIcon" src="img/e2e-unencrypted.svg" width="12" height="12" />
                        Enable encryption (warning: cannot be disabled again!)
                    </label>
                    { settings }
                </div>
            );
        }
        else {
            return (
                <div>
                    <label>
                    { isEncrypted
                      ? <img className="mx_RoomSettings_e2eIcon" src="img/e2e-verified.svg" width="10" height="12" />
                      : <img className="mx_RoomSettings_e2eIcon" src="img/e2e-unencrypted.svg" width="12" height="12" />
                    }
                    Encryption is { isEncrypted ? "" : "not " } enabled in this room.
                    </label>
                    { settings }
                </div>
            );
        }
    },

    render: function() {
        // TODO: go through greying out things you don't have permission to change
        // (or turning them into informative stuff)

        var AliasSettings = sdk.getComponent("room_settings.AliasSettings");
        var ColorSettings = sdk.getComponent("room_settings.ColorSettings");
        var UrlPreviewSettings = sdk.getComponent("room_settings.UrlPreviewSettings");
        var EditableText = sdk.getComponent('elements.EditableText');
        var PowerSelector = sdk.getComponent('elements.PowerSelector');
        var Loader = sdk.getComponent("elements.Spinner");

        var cli = MatrixClientPeg.get();
        var roomState = this.props.room.currentState;
        var user_id = cli.credentials.userId;

        var power_level_event = roomState.getStateEvents('m.room.power_levels', '');
        var power_levels = power_level_event ? power_level_event.getContent() : {};
        var events_levels = power_levels.events || {};
        var user_levels = power_levels.users || {};

        var ban_level = parseIntWithDefault(power_levels.ban, 50);
        var kick_level = parseIntWithDefault(power_levels.kick, 50);
        var redact_level = parseIntWithDefault(power_levels.redact, 50);
        var invite_level = parseIntWithDefault(power_levels.invite, 50);
        var send_level = parseIntWithDefault(power_levels.events_default, 0);
        var state_level = power_level_event ? parseIntWithDefault(power_levels.state_default, 50) : 0;
        var default_user_level = parseIntWithDefault(power_levels.users_default, 0);

        var current_user_level = user_levels[user_id];
        if (current_user_level === undefined) {
            current_user_level = default_user_level;
        }

        var can_change_levels = roomState.mayClientSendStateEvent("m.room.power_levels", cli);

        var canSetTag = !cli.isGuest();

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
            userLevelsSection = <div>No users have specific privileges in this room.</div>;
        }

        var banned = this.props.room.getMembersWithMembership("ban");
        var bannedUsersSection;
        if (banned.length) {
            bannedUsersSection =
                <div>
                    <h3>Banned users</h3>
                    <ul className="mx_RoomSettings_banned">
                        {banned.map(function(member) {
                            return (
                                <BannedUser key={member.userId} member={member} />
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

        var leaveButton = null;
        var myMember = this.props.room.getMember(user_id);
        if (myMember) {
            if (myMember.membership === "join") {
                leaveButton = (
                    <AccessibleButton className="mx_RoomSettings_leaveButton" onClick={ this.onLeaveClick }>
                        Leave room
                    </AccessibleButton>
                );
            }
            else if (myMember.membership === "leave") {
                leaveButton = (
                    <AccessibleButton className="mx_RoomSettings_leaveButton" onClick={ this.onForgetClick }>
                        Forget room
                    </AccessibleButton>
                );
            }
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

        var tagsSection = null;
        if (canSetTag || self.state.tags) {
            var tagsSection =
                <div className="mx_RoomSettings_tags">
                    Tagged as: { canSetTag ?
                        (tags.map(function(tag, i) {
                            return (<label key={ i }>
                                        <input type="checkbox"
                                               ref={ tag.ref }
                                               checked={ tag.name in self.state.tags }
                                               onChange={ self._onTagChange.bind(self, tag.name) }/>
                                        { tag.label }
                                    </label>);
                        })) : (self.state.tags && self.state.tags.join) ? self.state.tags.join(", ") : ""
                    }
                </div>;
        }

        // If there is no history_visibility, it is assumed to be 'shared'.
        // http://matrix.org/docs/spec/r0.0.0/client_server.html#id31
        var historyVisibility = this.state.history_visibility || "shared";

        var addressWarning;
        var aliasEvents = this.props.room.currentState.getStateEvents('m.room.aliases') || [];
        var aliasCount = 0;
        aliasEvents.forEach((event) => {
            aliasCount += event.getContent().aliases.length;
        });

        if (this.state.join_rule === "public" && aliasCount == 0) {
            addressWarning =
                <div className="mx_RoomSettings_warning">
                    To link to a room it must have <a href="#addresses">an address</a>.
                </div>;
        }

        var inviteGuestWarning;
        if (this.state.join_rule !== "public" && this.state.guest_access === "forbidden") {
            inviteGuestWarning =
                <div className="mx_RoomSettings_warning">
                    Guests cannot join this room even if explicitly invited. <a href="#" onClick={ (e) => {
                        this.setState({ join_rule: "invite", guest_access: "can_join" });
                        e.preventDefault();
                    }}>Click here to fix</a>.
                </div>;
        }

        var integrationsButton;
        var integrationsError;
        if (this.state.showIntegrationsError && this.state.scalar_error) {
            console.error(this.state.scalar_error);
            integrationsError = (
                <span className="mx_RoomSettings_integrationsButton_errorPopup">
                    Could not connect to the integration server
                </span>
            );
        }

        if (this.scalarClient.hasCredentials()) {
            integrationsButton = (
                    <div className="mx_RoomSettings_integrationsButton" onClick={ this.onManageIntegrations }>
                    Manage Integrations
                </div>
            );
        } else if (this.state.scalar_error) {
            integrationsButton = (
                    <div className="mx_RoomSettings_integrationsButton_error" onClick={ this.onShowIntegrationsError }>
                    Integrations Error <img src="img/warning.svg" width="17"/>
                    { integrationsError }
                </div>
            );
        } else {
            integrationsButton = (
                    <div className="mx_RoomSettings_integrationsButton" style={{ opacity: 0.5 }}>
                    Manage Integrations
                </div>
            );
        }

        return (
            <div className="mx_RoomSettings">

                { leaveButton }
                { integrationsButton }

                { tagsSection }

                <div className="mx_RoomSettings_toggles">
                    <div className="mx_RoomSettings_settings">
                        <h3>Who can access this room?</h3>
                        { inviteGuestWarning }
                        <label>
                            <input type="radio" name="roomVis" value="invite_only"
                                disabled={ !this.mayChangeRoomAccess() }
                                onChange={this._onRoomAccessRadioToggle}
                                checked={this.state.join_rule !== "public"}/>
                            Only people who have been invited
                        </label>
                        <label>
                            <input type="radio" name="roomVis" value="public_no_guests"
                                disabled={ !this.mayChangeRoomAccess() }
                                onChange={this._onRoomAccessRadioToggle}
                                checked={this.state.join_rule === "public" && this.state.guest_access !== "can_join"}/>
                            Anyone who knows the room's link, apart from guests
                        </label>
                        <label>
                            <input type="radio" name="roomVis" value="public_with_guests"
                                disabled={ !this.mayChangeRoomAccess() }
                                onChange={this._onRoomAccessRadioToggle}
                                checked={this.state.join_rule === "public" && this.state.guest_access === "can_join"}/>
                            Anyone who knows the room's link, including guests
                        </label>
                        { addressWarning }
                        <br/>
                        { this._renderEncryptionSection() }
                        <label>
                            <input type="checkbox" disabled={ !roomState.mayClientSendStateEvent("m.room.aliases", cli) }
                                   onChange={ this._onToggle.bind(this, "isRoomPublished", true, false)}
                                   checked={this.state.isRoomPublished}/>
                            List this room in { MatrixClientPeg.get().getDomain() }'s room directory?
                        </label>
                    </div>
                    <div className="mx_RoomSettings_settings">
                        <h3>Who can read history?</h3>
                        <label>
                            <input type="radio" name="historyVis" value="world_readable"
                                    disabled={ !roomState.mayClientSendStateEvent("m.room.history_visibility", cli) }
                                    checked={historyVisibility === "world_readable"}
                                    onChange={this._onHistoryRadioToggle} />
                            Anyone
                        </label>
                        <label>
                            <input type="radio" name="historyVis" value="shared"
                                    disabled={ !roomState.mayClientSendStateEvent("m.room.history_visibility", cli) }
                                    checked={historyVisibility === "shared"}
                                    onChange={this._onHistoryRadioToggle} />
                            Members only (since the point in time of selecting this option)
                        </label>
                        <label>
                            <input type="radio" name="historyVis" value="invited"
                                    disabled={ !roomState.mayClientSendStateEvent("m.room.history_visibility", cli) }
                                    checked={historyVisibility === "invited"}
                                    onChange={this._onHistoryRadioToggle} />
                            Members only (since they were invited)
                        </label>
                        <label >
                            <input type="radio" name="historyVis" value="joined"
                                    disabled={ !roomState.mayClientSendStateEvent("m.room.history_visibility", cli) }
                                    checked={historyVisibility === "joined"}
                                    onChange={this._onHistoryRadioToggle} />
                            Members only (since they joined)
                        </label>
                    </div>
                </div>


                <div>
                    <h3>Room Colour</h3>
                    <ColorSettings ref="color_settings" room={this.props.room} />
                </div>

                <a id="addresses"/>

                <AliasSettings ref="alias_settings"
                    roomId={this.props.room.roomId}
                    canSetCanonicalAlias={ roomState.mayClientSendStateEvent("m.room.canonical_alias", cli) }
                    canSetAliases={
                        true
                        /* Originally, we arbitrarily restricted creating aliases to room admins: roomState.mayClientSendStateEvent("m.room.aliases", cli) */
                    }
                    canonicalAliasEvent={this.props.room.currentState.getStateEvents('m.room.canonical_alias', '')}
                    aliasEvents={this.props.room.currentState.getStateEvents('m.room.aliases')} />

                <UrlPreviewSettings ref="url_preview_settings" room={this.props.room} />

                <h3>Permissions</h3>
                <div className="mx_RoomSettings_powerLevels mx_RoomSettings_settings">
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">The default role for new room members is </span>
                        <PowerSelector ref="users_default" value={default_user_level} controlled={false} disabled={!can_change_levels || current_user_level < default_user_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To send messages, you must be a </span>
                        <PowerSelector ref="events_default" value={send_level} controlled={false} disabled={!can_change_levels || current_user_level < send_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To invite users into the room, you must be a </span>
                        <PowerSelector ref="invite" value={invite_level} controlled={false} disabled={!can_change_levels || current_user_level < invite_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To configure the room, you must be a </span>
                        <PowerSelector ref="state_default" value={state_level} controlled={false} disabled={!can_change_levels || current_user_level < state_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To kick users, you must be a </span>
                        <PowerSelector ref="kick" value={kick_level} controlled={false} disabled={!can_change_levels || current_user_level < kick_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To ban users, you must be a </span>
                        <PowerSelector ref="ban" value={ban_level} controlled={false} disabled={!can_change_levels || current_user_level < ban_level} onChange={this.onPowerLevelsChanged}/>
                    </div>
                    <div className="mx_RoomSettings_powerLevel">
                        <span className="mx_RoomSettings_powerLevelKey">To redact messages, you must be a </span>
                        <PowerSelector ref="redact" value={redact_level} controlled={false} disabled={!can_change_levels || current_user_level < redact_level} onChange={this.onPowerLevelsChanged}/>
                    </div>

                    {Object.keys(events_levels).map(function(event_type, i) {
                        return (
                            <div className="mx_RoomSettings_powerLevel" key={event_type}>
                                <span className="mx_RoomSettings_powerLevelKey">To send events of type <code>{ event_type }</code>, you must be a </span>
                                <PowerSelector value={ events_levels[event_type] } controlled={false} disabled={true} onChange={self.onPowerLevelsChanged}/>
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

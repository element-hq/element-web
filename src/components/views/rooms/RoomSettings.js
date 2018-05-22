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

import Promise from 'bluebird';
import React from 'react';
import PropTypes from 'prop-types';
import { _t, _td } from '../../../languageHandler';
import MatrixClientPeg from '../../../MatrixClientPeg';
import sdk from '../../../index';
import Modal from '../../../Modal';
import ObjectUtils from '../../../ObjectUtils';
import dis from '../../../dispatcher';
import AccessibleButton from '../elements/AccessibleButton';
import SettingsStore, {SettingLevel} from "../../../settings/SettingsStore";


// parse a string as an integer; if the input is undefined, or cannot be parsed
// as an integer, return a default.
function parseIntWithDefault(val, def) {
    const res = parseInt(val);
    return isNaN(res) ? def : res;
}

const plEventsToLabels = {
    // These will be translated for us later.
    "m.room.avatar": _td("To change the room's avatar, you must be a"),
    "m.room.name": _td("To change the room's name, you must be a"),
    "m.room.canonical_alias": _td("To change the room's main address, you must be a"),
    "m.room.history_visibility": _td("To change the room's history visibility, you must be a"),
    "m.room.power_levels": _td("To change the permissions in the room, you must be a"),
    "m.room.topic": _td("To change the topic, you must be a"),

    "im.vector.modular.widgets": _td("To modify widgets in the room, you must be a"),
};

const plEventsToShow = {
    // If an event is listed here, it will be shown in the PL settings. Defaults will be calculated.
    "m.room.avatar": {isState: true},
    "m.room.name": {isState: true},
    "m.room.canonical_alias": {isState: true},
    "m.room.history_visibility": {isState: true},
    "m.room.power_levels": {isState: true},
    "m.room.topic": {isState: true},

    "im.vector.modular.widgets": {isState: true},
};

const BannedUser = React.createClass({
    propTypes: {
        canUnban: PropTypes.bool,
        member: PropTypes.object.isRequired, // js-sdk RoomMember
        by: PropTypes.string.isRequired,
        reason: PropTypes.string,
    },

    _onUnbanClick: function() {
        const ConfirmUserActionDialog = sdk.getComponent("dialogs.ConfirmUserActionDialog");
        Modal.createTrackedDialog('Confirm User Action Dialog', 'onUnbanClick', ConfirmUserActionDialog, {
            member: this.props.member,
            action: _t('Unban'),
            title: _t('Unban this user?'),
            danger: false,
            onFinished: (proceed) => {
                if (!proceed) return;

                MatrixClientPeg.get().unban(
                    this.props.member.roomId, this.props.member.userId,
                ).catch((err) => {
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    console.error("Failed to unban: " + err);
                    Modal.createTrackedDialog('Failed to unban', '', ErrorDialog, {
                        title: _t('Error'),
                        description: _t('Failed to unban'),
                    });
                }).done();
            },
        });
    },

    render: function() {
        let unbanButton;

        if (this.props.canUnban) {
            unbanButton = <AccessibleButton className="mx_RoomSettings_unbanButton" onClick={this._onUnbanClick}>
                { _t('Unban') }
            </AccessibleButton>;
        }

        return (
            <li>
                { unbanButton }
                <span title={_t("Banned by %(displayName)s", {displayName: this.props.by})}>
                    <strong>{ this.props.member.name }</strong> { this.props.member.userId }
                    { this.props.reason ? " " +_t('Reason') + ": " + this.props.reason : "" }
                </span>
            </li>
        );
    },
});

module.exports = React.createClass({
    displayName: 'RoomSettings',

    propTypes: {
        room: PropTypes.object.isRequired,
    },

    getInitialState: function() {
        const tags = {};
        Object.keys(this.props.room.tags).forEach(function(tagName) {
            tags[tagName] = ['yep'];
        });

        return {
            name: this._yankValueFromEvent("m.room.name", "name"),
            topic: this._yankValueFromEvent("m.room.topic", "topic"),
            join_rule: this._yankValueFromEvent("m.room.join_rules", "join_rule"),
            history_visibility: this._yankValueFromEvent("m.room.history_visibility", "history_visibility"),
            guest_access: this._yankValueFromEvent("m.room.guest_access", "guest_access"),
            powerLevels: this._yankContentFromEvent("m.room.power_levels", {}),
            powerLevelsChanged: false,
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
        };
    },

    componentWillMount: function() {
        MatrixClientPeg.get().on("RoomMember.membership", this._onRoomMemberMembership);

        MatrixClientPeg.get().getRoomDirectoryVisibility(
            this.props.room.roomId,
        ).done((result = {}) => {
            this.setState({ isRoomPublished: result.visibility === "public" });
            this._originalIsRoomPublished = result.visibility === "public";
        }, (err) => {
            console.error("Failed to get room visibility: " + err);
        });

        dis.dispatch({
            action: 'panel_disable',
            sideDisabled: true,
            middleDisabled: true,
        });
    },

    componentWillUnmount: function() {
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener("RoomMember.membership", this._onRoomMemberMembership);
        }

        dis.dispatch({
            action: 'panel_disable',
            sideDisabled: false,
            middleDisabled: false,
        });
    },

    setName: function(name) {
        this.setState({
            name: name,
        });
    },

    setTopic: function(topic) {
        this.setState({
            topic: topic,
        });
    },

    /**
     * Returns a promise which resolves once all of the save operations have completed or failed.
     *
     * The result is a list of promise state snapshots, each with the form
     * `{ state: "fulfilled", value: v }` or `{ state: "rejected", reason: r }`.
     */
    save: function() {
        const stateWasSetDefer = Promise.defer();
        // the caller may have JUST called setState on stuff, so we need to re-render before saving
        // else we won't use the latest values of things.
        // We can be a bit cheeky here and set a loading flag, and listen for the callback on that
        // to know when things have been set.
        this.setState({ _loading: true}, () => {
            stateWasSetDefer.resolve();
            this.setState({ _loading: false});
        });

        function mapPromiseToSnapshot(p) {
            return p.then((r) => {
                return { state: "fulfilled", value: r };
            }, (e) => {
                return { state: "rejected", reason: e };
            });
        }

        return stateWasSetDefer.promise.then(() => {
            return Promise.all(
                this._calcSavePromises().map(mapPromiseToSnapshot),
            );
        });
    },

    _calcSavePromises: function() {
        const roomId = this.props.room.roomId;
        const promises = this.saveAliases(); // returns Promise[]
        const originalState = this.getInitialState();

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
                "",
            ));
        }

        if (this.state.isRoomPublished !== originalState.isRoomPublished) {
            promises.push(MatrixClientPeg.get().setRoomDirectoryVisibility(
                roomId,
                this.state.isRoomPublished ? "public" : "private",
            ));
        }

        if (this.state.join_rule !== originalState.join_rule) {
            promises.push(MatrixClientPeg.get().sendStateEvent(
                roomId, "m.room.join_rules",
                { join_rule: this.state.join_rule },
                "",
            ));
        }

        if (this.state.guest_access !== originalState.guest_access) {
            promises.push(MatrixClientPeg.get().sendStateEvent(
                roomId, "m.room.guest_access",
                { guest_access: this.state.guest_access },
                "",
            ));
        }


        // power levels
        const powerLevels = this.state.powerLevels;
        if (this.state.powerLevelsChanged) {
            promises.push(MatrixClientPeg.get().sendStateEvent(
                roomId, "m.room.power_levels", powerLevels, "",
            ));
        }

        // tags
        if (this.state.tags_changed) {
            const tagDiffs = ObjectUtils.getKeyValueArrayDiffs(originalState.tags, this.state.tags);
            // [ {place: add, key: "m.favourite", val: ["yep"]} ]
            tagDiffs.forEach(function(diff) {
                switch (diff.place) {
                    case "add":
                        promises.push(
                            MatrixClientPeg.get().setRoomTag(roomId, diff.key, {}),
                        );
                        break;
                    case "del":
                        promises.push(
                            MatrixClientPeg.get().deleteRoomTag(roomId, diff.key),
                        );
                        break;
                    default:
                        console.error("Unknown tag operation: %s", diff.place);
                        break;
                }
            });
        }

        // color scheme
        let p;
        p = this.saveColor();
        if (!p.isFulfilled()) {
            promises.push(p);
        }

        // url preview settings
        const ps = this.saveUrlPreviewSettings();
        if (ps.length > 0) {
            ps.map((p) => promises.push(p));
        }

        // related groups
        promises.push(this.saveRelatedGroups());

        // encryption
        p = this.saveEnableEncryption();
        if (!p.isFulfilled()) {
            promises.push(p);
        }

        this.saveBlacklistUnverifiedDevicesPerRoom();

        console.log("Performing %s operations: %s", promises.length, JSON.stringify(promises));
        return promises;
    },

    saveAliases: function() {
        if (!this.refs.alias_settings) { return [Promise.resolve()]; }
        return this.refs.alias_settings.saveSettings();
    },

    saveRelatedGroups: function() {
        if (!this.refs.related_groups) { return Promise.resolve(); }
        return this.refs.related_groups.saveSettings();
    },

    saveColor: function() {
        if (!this.refs.color_settings) { return Promise.resolve(); }
        return this.refs.color_settings.saveSettings();
    },

    saveUrlPreviewSettings: function() {
        if (!this.refs.url_preview_settings) { return Promise.resolve(); }
        return this.refs.url_preview_settings.saveSettings();
    },

    saveEnableEncryption: function() {
        if (!this.refs.encrypt) { return Promise.resolve(); }

        const encrypt = this.refs.encrypt.checked;
        if (!encrypt) { return Promise.resolve(); }

        const roomId = this.props.room.roomId;
        return MatrixClientPeg.get().sendStateEvent(
            roomId, "m.room.encryption",
            { algorithm: "m.megolm.v1.aes-sha2" },
        );
    },

    saveBlacklistUnverifiedDevicesPerRoom: function() {
        if (!this.refs.blacklistUnverifiedDevices) return;
        this.refs.blacklistUnverifiedDevices.save().then(() => {
            const value = SettingsStore.getValueAt(
                SettingLevel.ROOM_DEVICE,
                "blacklistUnverifiedDevices",
                this.props.room.roomId,
                /*explicit=*/true,
            );
            this.props.room.setBlacklistUnverifiedDevices(value);
        });
    },

    _hasDiff: function(strA, strB) {
        // treat undefined as an empty string because other components may blindly
        // call setName("") when there has been no diff made to the name!
        strA = strA || "";
        strB = strB || "";
        return strA !== strB;
    },

    onPowerLevelsChanged: function(value, powerLevelKey) {
        const powerLevels = Object.assign({}, this.state.powerLevels);
        const eventsLevelPrefix = "event_levels_";

        value = parseInt(value);

        if (powerLevelKey.startsWith(eventsLevelPrefix)) {
            // deep copy "events" object, Object.assign itself won't deep copy
            powerLevels["events"] = Object.assign({}, this.state.powerLevels["events"] || {});
            powerLevels["events"][powerLevelKey.slice(eventsLevelPrefix.length)] = value;
        } else {
            powerLevels[powerLevelKey] = value;
        }
        this.setState({
            powerLevels,
            powerLevelsChanged: true,
        });
    },

    _yankContentFromEvent: function(stateEventType, defaultValue) {
        // E.g.("m.room.name") would yank the content of "m.room.name"
        const event = this.props.room.currentState.getStateEvents(stateEventType, '');
        if (!event) {
            return defaultValue;
        }
        return event.getContent() || defaultValue;
    },

    _yankValueFromEvent: function(stateEventType, keyName, defaultValue) {
        // E.g.("m.room.name","name") would yank the "name" content key from "m.room.name"
        const event = this.props.room.currentState.getStateEvents(stateEventType, '');
        if (!event) {
            return defaultValue;
        }
        const content = event.getContent();
        return keyName in content ? content[keyName] : defaultValue;
    },

    _onHistoryRadioToggle: function(ev) {
        const self = this;
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");

        // cancel the click unless the user confirms it
        ev.preventDefault();
        const value = ev.target.value;

        Modal.createTrackedDialog('Privacy warning', '', QuestionDialog, {
            title: _t('Privacy warning'),
            description:
                <div>
                    { _t('Changes to who can read history will only apply to future messages in this room') }.<br />
                    { _t('The visibility of existing history will be unchanged') }.
                </div>,
            button: _t('Continue'),
            onFinished: function(confirmed) {
                if (confirmed) {
                    self.setState({
                        history_visibility: value,
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
        const state = {};
        state[keyName] = ev.target.checked ? checkedValue : uncheckedValue;
        this.setState(state);
    },

    _onTagChange: function(tagName, event) {
        if (event.target.checked) {
            if (tagName === 'm.favourite') {
                delete this.state.tags['m.lowpriority'];
            } else if (tagName === 'm.lowpriority') {
                delete this.state.tags['m.favourite'];
            }

            this.state.tags[tagName] = this.state.tags[tagName] || ["yep"];
        } else {
            delete this.state.tags[tagName];
        }

        this.setState({
            tags: this.state.tags,
            tags_changed: true,
        });
    },

    mayChangeRoomAccess: function() {
        const cli = MatrixClientPeg.get();
        const roomState = this.props.room.currentState;
        return (roomState.mayClientSendStateEvent("m.room.join_rules", cli) &&
                roomState.mayClientSendStateEvent("m.room.guest_access", cli));
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
            const errCode = err.errcode || _t('unknown error code');
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to forget room', '', ErrorDialog, {
                title: _t('Error'),
                description: _t("Failed to forget room %(errCode)s", { errCode: errCode }),
            });
        });
    },

    onEnableEncryptionClick() {
        if (!this.refs.encrypt.checked) return;

        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        Modal.createTrackedDialog('E2E Enable Warning', '', QuestionDialog, {
            title: _t('Warning!'),
            description: (
                <div>
                    <p>{ _t('End-to-end encryption is in beta and may not be reliable') }.</p>
                    <p>{ _t('You should not yet trust it to secure data') }.</p>
                    <p>{ _t('Devices will not yet be able to decrypt history from before they joined the room') }.</p>
                    <p>{ _t('Once encryption is enabled for a room it cannot be turned off again (for now)') }.</p>
                    <p>{ _t('Encrypted messages will not be visible on clients that do not yet implement encryption') }.</p>
                </div>
            ),
            onFinished: (confirm)=>{
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

    _populateDefaultPlEvents: function(eventsSection, stateLevel, eventsLevel) {
        for (const desiredEvent of Object.keys(plEventsToShow)) {
            if (!(desiredEvent in eventsSection)) {
                eventsSection[desiredEvent] = (plEventsToShow[desiredEvent].isState ? stateLevel : eventsLevel);
            }
        }
    },

    _renderEncryptionSection: function() {
        const SettingsFlag = sdk.getComponent("elements.SettingsFlag");

        const cli = MatrixClientPeg.get();
        const roomState = this.props.room.currentState;
        const isEncrypted = cli.isRoomEncrypted(this.props.room.roomId);

        const settings = (
            <SettingsFlag name="blacklistUnverifiedDevices"
                          level={SettingLevel.ROOM_DEVICE}
                          roomId={this.props.room.roomId}
                          manualSave={true}
                          ref="blacklistUnverifiedDevices"
            />
        );

        if (!isEncrypted && roomState.mayClientSendStateEvent("m.room.encryption", cli)) {
            return (
                <div>
                    <label>
                        <input type="checkbox" ref="encrypt" onClick={this.onEnableEncryptionClick} />
                        <img className="mx_RoomSettings_e2eIcon mx_filterFlipColor" src="img/e2e-unencrypted.svg" width="12" height="12" />
                        { _t('Enable encryption') } { _t('(warning: cannot be disabled again!)') }
                    </label>
                    { settings }
                </div>
            );
        } else {
            return (
                <div>
                    <label>
                    { isEncrypted
                      ? <img className="mx_RoomSettings_e2eIcon" src="img/e2e-verified.svg" width="10" height="12" />
                      : <img className="mx_RoomSettings_e2eIcon mx_filterFlipColor" src="img/e2e-unencrypted.svg" width="12" height="12" />
                    }
                    { isEncrypted ? _t("Encryption is enabled in this room") : _t("Encryption is not enabled in this room") }.
                    </label>
                    { settings }
                </div>
            );
        }
    },

    render: function() {
        // TODO: go through greying out things you don't have permission to change
        // (or turning them into informative stuff)

        const AliasSettings = sdk.getComponent("room_settings.AliasSettings");
        const ColorSettings = sdk.getComponent("room_settings.ColorSettings");
        const UrlPreviewSettings = sdk.getComponent("room_settings.UrlPreviewSettings");
        const RelatedGroupSettings = sdk.getComponent("room_settings.RelatedGroupSettings");
        const PowerSelector = sdk.getComponent('elements.PowerSelector');

        const cli = MatrixClientPeg.get();
        const roomState = this.props.room.currentState;
        const myUserId = cli.credentials.userId;

        const powerLevels = this.state.powerLevels;
        const eventsLevels = powerLevels.events || {};
        const userLevels = powerLevels.users || {};

        const powerLevelDescriptors = {
            users_default: {
                desc: _t('The default role for new room members is'),
                defaultValue: 0,
            },
            events_default: {
                desc: _t('To send messages, you must be a'),
                defaultValue: 0,
            },
            invite: {
                desc: _t('To invite users into the room, you must be a'),
                defaultValue: 50,
            },
            state_default: {
                desc: _t('To configure the room, you must be a'),
                defaultValue: 50,
            },
            kick: {
                desc: _t('To kick users, you must be a'),
                defaultValue: 50,
            },
            ban: {
                desc: _t('To ban users, you must be a'),
                defaultValue: 50,
            },
            redact: {
                desc: _t('To remove other users\' messages, you must be a'),
                defaultValue: 50,
            },
        };

        const banLevel = parseIntWithDefault(powerLevels.ban, powerLevelDescriptors.ban.defaultValue);
        const defaultUserLevel = parseIntWithDefault(
            powerLevels.users_default,
            powerLevelDescriptors.users_default.defaultValue,
        );

        this._populateDefaultPlEvents(
            eventsLevels,
            parseIntWithDefault(powerLevels.state_default, powerLevelDescriptors.state_default.defaultValue),
            parseIntWithDefault(powerLevels.events_default, powerLevelDescriptors.events_default.defaultValue),
        );

        let currentUserLevel = userLevels[myUserId];
        if (currentUserLevel === undefined) {
            currentUserLevel = defaultUserLevel;
        }

        const canChangeLevels = roomState.mayClientSendStateEvent("m.room.power_levels", cli);

        const canSetTag = !cli.isGuest();

        const self = this;

        const relatedGroupsSection = <RelatedGroupSettings ref="related_groups"
            roomId={this.props.room.roomId}
            canSetRelatedGroups={roomState.mayClientSendStateEvent("m.room.related_groups", cli)}
            relatedGroupsEvent={this.props.room.currentState.getStateEvents('m.room.related_groups', '')}
        />;

        let privilegedUsersSection = <div>{ _t('No users have specific privileges in this room') }.</div>; // default
        let mutedUsersSection;
        if (Object.keys(userLevels).length) {
            const privilegedUsers = [];
            const mutedUsers = [];

            Object.keys(userLevels).forEach(function(user) {
                if (userLevels[user] > defaultUserLevel) { // privileged
                    privilegedUsers.push(<li className="mx_RoomSettings_userLevel" key={user}>
                        { _t("%(user)s is a %(userRole)s", {
                            user: user,
                            userRole: <PowerSelector value={userLevels[user]} disabled={true} />,
                        }) }
                    </li>);
                } else if (userLevels[user] < defaultUserLevel) { // muted
                    mutedUsers.push(<li className="mx_RoomSettings_userLevel" key={user}>
                        { _t("%(user)s is a %(userRole)s", {
                            user: user,
                            userRole: <PowerSelector value={userLevels[user]} disabled={true} />,
                        }) }
                    </li>);
                }
            });

            // comparator for sorting PL users lexicographically on PL descending, MXID ascending. (case-insensitive)
            const comparator = (a, b) => {
                const plDiff = userLevels[b.key] - userLevels[a.key];
                return plDiff !== 0 ? plDiff : a.key.toLocaleLowerCase().localeCompare(b.key.toLocaleLowerCase());
            };

            privilegedUsers.sort(comparator);
            mutedUsers.sort(comparator);

            if (privilegedUsers.length) {
                privilegedUsersSection =
                    <div>
                        <h3>{ _t('Privileged Users') }</h3>
                        <ul className="mx_RoomSettings_userLevels">
                            { privilegedUsers }
                        </ul>
                    </div>;
            }
            if (mutedUsers.length) {
                mutedUsersSection =
                    <div>
                        <h3>{ _t('Muted Users') }</h3>
                        <ul className="mx_RoomSettings_userLevels">
                            { mutedUsers }
                        </ul>
                    </div>;
            }
        }

        const banned = this.props.room.getMembersWithMembership("ban");
        let bannedUsersSection;
        if (banned.length) {
            const canBanUsers = currentUserLevel >= banLevel;
            bannedUsersSection =
                <div>
                    <h3>{ _t('Banned users') }</h3>
                    <ul className="mx_RoomSettings_banned">
                        { banned.map(function(member) {
                            const banEvent = member.events.member.getContent();
                            const sender = self.props.room.getMember(member.events.member.getSender());
                            let bannedBy = member.events.member.getSender(); // start by falling back to mxid
                            if (sender) bannedBy = sender.name;
                            return (
                                <BannedUser key={member.userId} canUnban={canBanUsers} member={member} reason={banEvent.reason} by={bannedBy} />
                            );
                        }) }
                    </ul>
                </div>;
        }

        let unfederatableSection;
        if (this._yankValueFromEvent("m.room.create", "m.federate", true) === false) {
             unfederatableSection = (
                <div className="mx_RoomSettings_powerLevel">
                    { _t('This room is not accessible by remote Matrix servers') }.
                </div>
            );
        }

        let leaveButton = null;
        const myMember = this.props.room.getMember(myUserId);
        if (myMember) {
            if (myMember.membership === "join") {
                leaveButton = (
                    <AccessibleButton className="mx_RoomSettings_leaveButton" onClick={this.onLeaveClick}>
                        { _t('Leave room') }
                    </AccessibleButton>
                );
            } else if (myMember.membership === "leave") {
                leaveButton = (
                    <AccessibleButton className="mx_RoomSettings_leaveButton" onClick={this.onForgetClick}>
                        { _t('Forget room') }
                    </AccessibleButton>
                );
            }
        }

        // TODO: support editing custom events_levels
        // TODO: support editing custom user_levels

        const tags = [
            { name: "m.favourite", label: _t('Favourite'), ref: "tag_favourite" },
            { name: "m.lowpriority", label: _t('Low priority'), ref: "tag_lowpriority" },
        ];

        Object.keys(this.state.tags).sort().forEach(function(tagName) {
            if (tagName !== 'm.favourite' && tagName !== 'm.lowpriority') {
                tags.push({ name: tagName, label: tagName });
            }
        });

        let tagsSection = null;
        if (canSetTag || self.state.tags) {
            tagsSection =
                <div className="mx_RoomSettings_tags">
                    { _t("Tagged as: ") }{ canSetTag ?
                        (tags.map(function(tag, i) {
                            return (<label key={i}>
                                        <input type="checkbox"
                                               ref={tag.ref}
                                               checked={tag.name in self.state.tags}
                                               onChange={self._onTagChange.bind(self, tag.name)} />
                                        { tag.label }
                                    </label>);
                        })) : (self.state.tags && self.state.tags.join) ? self.state.tags.join(", ") : ""
                    }
                </div>;
        }

        // If there is no history_visibility, it is assumed to be 'shared'.
        // http://matrix.org/docs/spec/r0.0.0/client_server.html#id31
        const historyVisibility = this.state.history_visibility || "shared";

        let addressWarning;
        const aliasEvents = this.props.room.currentState.getStateEvents('m.room.aliases') || [];
        let aliasCount = 0;
        aliasEvents.forEach((event) => {
            const aliases = event.getContent().aliases || [];
            aliasCount += aliases.length;
        });

        if (this.state.join_rule === "public" && aliasCount == 0) {
            addressWarning =
                <div className="mx_RoomSettings_warning">
                        { _t(
                            'To link to a room it must have <a>an address</a>.',
                            {},
                            { 'a': (sub) => <a href="#addresses">{ sub }</a> },
                        ) }
                </div>;
        }

        let inviteGuestWarning;
        if (this.state.join_rule !== "public" && this.state.guest_access === "forbidden") {
            inviteGuestWarning =
                <div className="mx_RoomSettings_warning">
                    { _t('Guests cannot join this room even if explicitly invited.') } <a href="#" onClick={(e) => {
                        this.setState({ join_rule: "invite", guest_access: "can_join" });
                        e.preventDefault();
                    }}>{ _t('Click here to fix') }</a>.
                </div>;
        }

        const powerSelectors = Object.keys(powerLevelDescriptors).map((key, index) => {
            const descriptor = powerLevelDescriptors[key];

            const value = parseIntWithDefault(powerLevels[key], descriptor.defaultValue);
            return <div key={index} className="mx_RoomSettings_powerLevel">
                <span className="mx_RoomSettings_powerLevelKey">
                    { descriptor.desc }
                </span>
                <PowerSelector
                    value={value}
                    usersDefault={defaultUserLevel}
                    controlled={false}
                    disabled={!canChangeLevels || currentUserLevel < value}
                    powerLevelKey={key} // Will be sent as the second parameter to `onChange`
                    onChange={this.onPowerLevelsChanged}
                />
            </div>;
        });

        const eventPowerSelectors = Object.keys(eventsLevels).map(function(eventType, i) {
            let label = plEventsToLabels[eventType];
            if (label) {
                label = _t(label);
            } else {
                label = _t(
                    "To send events of type <eventType/>, you must be a", {},
                    { 'eventType': <code>{ eventType }</code> },
                );
            }
            return (
                <div className="mx_RoomSettings_powerLevel" key={eventType}>
                    <span className="mx_RoomSettings_powerLevelKey">{ label } </span>
                    <PowerSelector
                        value={eventsLevels[eventType]}
                        usersDefault={defaultUserLevel}
                        controlled={false}
                        disabled={!canChangeLevels || currentUserLevel < eventsLevels[eventType]}
                        powerLevelKey={"event_levels_" + eventType}
                        onChange={self.onPowerLevelsChanged}
                    />
                </div>
            );
        });

        return (
            <div className="mx_RoomSettings">

                { leaveButton }

                { tagsSection }

                <div className="mx_RoomSettings_toggles">
                    <div className="mx_RoomSettings_settings">
                        <h3>{ _t('Who can access this room?') }</h3>
                        { inviteGuestWarning }
                        <label>
                            <input type="radio" name="roomVis" value="invite_only"
                                disabled={!this.mayChangeRoomAccess()}
                                onChange={this._onRoomAccessRadioToggle}
                                checked={this.state.join_rule !== "public"} />
                            { _t('Only people who have been invited') }
                        </label>
                        <label>
                            <input type="radio" name="roomVis" value="public_no_guests"
                                disabled={!this.mayChangeRoomAccess()}
                                onChange={this._onRoomAccessRadioToggle}
                                checked={this.state.join_rule === "public" && this.state.guest_access !== "can_join"} />
                            { _t('Anyone who knows the room\'s link, apart from guests') }
                        </label>
                        <label>
                            <input type="radio" name="roomVis" value="public_with_guests"
                                disabled={!this.mayChangeRoomAccess()}
                                onChange={this._onRoomAccessRadioToggle}
                                checked={this.state.join_rule === "public" && this.state.guest_access === "can_join"} />
                            { _t('Anyone who knows the room\'s link, including guests') }
                        </label>
                        { addressWarning }
                        <br />
                        { this._renderEncryptionSection() }
                        <label>
                            <input type="checkbox" disabled={!roomState.mayClientSendStateEvent("m.room.aliases", cli)}
                                   onChange={this._onToggle.bind(this, "isRoomPublished", true, false)}
                                   checked={this.state.isRoomPublished} />
                            { _t("Publish this room to the public in %(domain)s's room directory?", { domain: MatrixClientPeg.get().getDomain() }) }
                        </label>
                    </div>
                    <div className="mx_RoomSettings_settings">
                        <h3>{ _t('Who can read history?') }</h3>
                        <label>
                            <input type="radio" name="historyVis" value="world_readable"
                                    disabled={!roomState.mayClientSendStateEvent("m.room.history_visibility", cli)}
                                    checked={historyVisibility === "world_readable"}
                                    onChange={this._onHistoryRadioToggle} />
                            { _t("Anyone") }
                        </label>
                        <label>
                            <input type="radio" name="historyVis" value="shared"
                                    disabled={!roomState.mayClientSendStateEvent("m.room.history_visibility", cli)}
                                    checked={historyVisibility === "shared"}
                                    onChange={this._onHistoryRadioToggle} />
                            { _t('Members only (since the point in time of selecting this option)') }
                        </label>
                        <label>
                            <input type="radio" name="historyVis" value="invited"
                                    disabled={!roomState.mayClientSendStateEvent("m.room.history_visibility", cli)}
                                    checked={historyVisibility === "invited"}
                                    onChange={this._onHistoryRadioToggle} />
                            { _t('Members only (since they were invited)') }
                        </label>
                        <label >
                            <input type="radio" name="historyVis" value="joined"
                                    disabled={!roomState.mayClientSendStateEvent("m.room.history_visibility", cli)}
                                    checked={historyVisibility === "joined"}
                                    onChange={this._onHistoryRadioToggle} />
                            { _t('Members only (since they joined)') }
                        </label>
                    </div>
                </div>


                <div>
                    <h3>{ _t('Room Colour') }</h3>
                    <ColorSettings ref="color_settings" room={this.props.room} />
                </div>

                <a id="addresses" />

                <AliasSettings ref="alias_settings"
                    roomId={this.props.room.roomId}
                    canSetCanonicalAlias={roomState.mayClientSendStateEvent("m.room.canonical_alias", cli)}
                    canSetAliases={
                        true
                        /* Originally, we arbitrarily restricted creating aliases to room admins: roomState.mayClientSendStateEvent("m.room.aliases", cli) */
                    }
                    canonicalAliasEvent={this.props.room.currentState.getStateEvents('m.room.canonical_alias', '')}
                    aliasEvents={this.props.room.currentState.getStateEvents('m.room.aliases')} />

                { relatedGroupsSection }

                <UrlPreviewSettings ref="url_preview_settings" room={this.props.room} />

                <h3>{ _t('Permissions') }</h3>
                <div className="mx_RoomSettings_powerLevels mx_RoomSettings_settings">
                    { powerSelectors }
                    { eventPowerSelectors }
                    { unfederatableSection }
                </div>

                { privilegedUsersSection }
                { mutedUsersSection }
                { bannedUsersSection }

                <h3>{ _t('Advanced') }</h3>
                <div className="mx_RoomSettings_settings">
                    { _t('This room\'s internal ID is') } <code>{ this.props.room.roomId }</code>
                </div>
            </div>
        );
    },
});

/*
Copyright 2019 New Vector Ltd

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

import React from 'react';
import PropTypes from 'prop-types';
import {_t, _td} from "../../../../languageHandler";
import MatrixClientPeg from "../../../../MatrixClientPeg";
import sdk from "../../../../index";
import AccessibleButton from "../../elements/AccessibleButton";
import Modal from "../../../../Modal";

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

// parse a string as an integer; if the input is undefined, or cannot be parsed
// as an integer, return a default.
function parseIntWithDefault(val, def) {
    const res = parseInt(val);
    return isNaN(res) ? def : res;
}

export class BannedUser extends React.Component {
    static propTypes = {
        canUnban: PropTypes.bool,
        member: PropTypes.object.isRequired, // js-sdk RoomMember
        by: PropTypes.string.isRequired,
        reason: PropTypes.string,
        onUnbanned: PropTypes.func.isRequired,
    };

    _onUnbanClick = (e) => {
        MatrixClientPeg.get().unban(this.props.member.roomId, this.props.member.userId).then(() => {
            this.props.onUnbanned();
        }).catch((err) => {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            console.error("Failed to unban: " + err);
            Modal.createTrackedDialog('Failed to unban', '', ErrorDialog, {
                title: _t('Error'),
                description: _t('Failed to unban'),
            });
        });
    };

    render() {
        let unbanButton;

        if (this.props.canUnban) {
            unbanButton = (
                <AccessibleButton kind='danger_sm' onClick={this._onUnbanClick}
                                  className='mx_RolesRoomSettingsTab_unbanBtn'>
                    { _t('Unban') }
                </AccessibleButton>
            );
        }

        const userId = this.props.member.name === this.props.member.userId ? null : this.props.member.userId;
        return (
            <li>
                {unbanButton}
                <span title={_t("Banned by %(displayName)s", {displayName: this.props.by})}>
                    <strong>{ this.props.member.name }</strong> {userId}
                    {this.props.reason ? " " + _t('Reason') + ": " + this.props.reason : ""}
                </span>
            </li>
        );
    }
}

export default class RolesRoomSettingsTab extends React.Component {
    static propTypes = {
        roomId: PropTypes.string.isRequired,
    };

    _populateDefaultPlEvents(eventsSection, stateLevel, eventsLevel) {
        for (const desiredEvent of Object.keys(plEventsToShow)) {
            if (!(desiredEvent in eventsSection)) {
                eventsSection[desiredEvent] = (plEventsToShow[desiredEvent].isState ? stateLevel : eventsLevel);
            }
        }
    }

    _onPowerLevelsChanged = (value, powerLevelKey) => {
        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);
        const plEvent = room.currentState.getStateEvents('m.room.power_levels', '');
        let plContent = plEvent ? (plEvent.getContent() || {}) : {};

        // Clone the power levels just in case
        plContent = Object.assign({}, plContent);

        const eventsLevelPrefix = "event_levels_";

        value = parseInt(value);

        if (powerLevelKey.startsWith(eventsLevelPrefix)) {
            // deep copy "events" object, Object.assign itself won't deep copy
            plContent["events"] = Object.assign({}, plContent["events"] || {});
            plContent["events"][powerLevelKey.slice(eventsLevelPrefix.length)] = value;
        } else {
            const keyPath = powerLevelKey.split('.');
            let parentObj;
            let currentObj = plContent;
            for (const key of keyPath) {
                if (!currentObj[key]) {
                    currentObj[key] = {};
                }
                parentObj = currentObj;
                currentObj = currentObj[key];
            }
            parentObj[keyPath[keyPath.length - 1]] = value;
        }

        client.sendStateEvent(this.props.roomId, "m.room.power_levels", plContent);
    };

    render() {
        const PowerSelector = sdk.getComponent('elements.PowerSelector');

        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);
        const plEvent = room.currentState.getStateEvents('m.room.power_levels', '');
        const plContent = plEvent ? (plEvent.getContent() || {}) : {};
        const canChangeLevels = room.currentState.mayClientSendStateEvent('m.room.power_levels', client);

        const powerLevelDescriptors = {
            "users_default": {
                desc: _t('The default role for new room members is'),
                defaultValue: 0,
            },
            "events_default": {
                desc: _t('To send messages, you must be a'),
                defaultValue: 0,
            },
            "invite": {
                desc: _t('To invite users into the room, you must be a'),
                defaultValue: 50,
            },
            "state_default": {
                desc: _t('To configure the room, you must be a'),
                defaultValue: 50,
            },
            "kick": {
                desc: _t('To kick users, you must be a'),
                defaultValue: 50,
            },
            "ban": {
                desc: _t('To ban users, you must be a'),
                defaultValue: 50,
            },
            "redact": {
                desc: _t('To remove other users\' messages, you must be a'),
                defaultValue: 50,
            },
            "notifications.room": {
                desc: _t('To notify everyone in the room, you must be a'),
                defaultValue: 50,
            },
        };

        const eventsLevels = plContent.events || {};
        const userLevels = plContent.users || {};
        const banLevel = parseIntWithDefault(plContent.ban, powerLevelDescriptors.ban.defaultValue);
        const defaultUserLevel = parseIntWithDefault(
            plContent.users_default,
            powerLevelDescriptors.users_default.defaultValue,
        );

        let currentUserLevel = userLevels[client.getUserId()];
        if (currentUserLevel === undefined) {
            currentUserLevel = defaultUserLevel;
        }

        this._populateDefaultPlEvents(
            eventsLevels,
            parseIntWithDefault(plContent.state_default, powerLevelDescriptors.state_default.defaultValue),
            parseIntWithDefault(plContent.events_default, powerLevelDescriptors.events_default.defaultValue),
        );

        let privilegedUsersSection = <div>{_t('No users have specific privileges in this room')}</div>;
        let mutedUsersSection;
        if (Object.keys(userLevels).length) {
            const privilegedUsers = [];
            const mutedUsers = [];

            Object.keys(userLevels).forEach(function(user) {
                if (userLevels[user] > defaultUserLevel) { // privileged
                    privilegedUsers.push(<li key={user}>
                        { _t("%(user)s is a %(userRole)s", {
                            user: user,
                            userRole: <PowerSelector value={userLevels[user]} disabled={true} />,
                        }) }
                    </li>);
                } else if (userLevels[user] < defaultUserLevel) { // muted
                    mutedUsers.push(<li key={user}>
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
                    <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                        <div className='mx_SettingsTab_subheading'>{ _t('Privileged Users') }</div>
                        <ul>
                            {privilegedUsers}
                        </ul>
                    </div>;
            }
            if (mutedUsers.length) {
                mutedUsersSection =
                    <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                        <div className='mx_SettingsTab_subheading'>{ _t('Muted Users') }</div>
                        <ul>
                            {mutedUsers}
                        </ul>
                    </div>;
            }
        }

        const banned = room.getMembersWithMembership("ban");
        let bannedUsersSection;
        if (banned.length) {
            const canBanUsers = currentUserLevel >= banLevel;
            bannedUsersSection =
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    <div className='mx_SettingsTab_subheading'>{ _t('Banned users') }</div>
                    <ul>
                        {banned.map((member) => {
                            const banEvent = member.events.member.getContent();
                            const sender = room.getMember(member.events.member.getSender());
                            let bannedBy = member.events.member.getSender(); // start by falling back to mxid
                            if (sender) bannedBy = sender.name;
                            return (
                                <BannedUser key={member.userId} canUnban={canBanUsers}
                                            member={member} reason={banEvent.reason}
                                            by={bannedBy} onUnbanned={this.forceUpdate} />
                            );
                        })}
                    </ul>
                </div>;
        }

        const powerSelectors = Object.keys(powerLevelDescriptors).map((key, index) => {
            const descriptor = powerLevelDescriptors[key];

            const keyPath = key.split('.');
            let currentObj = plContent;
            for (const prop of keyPath) {
                if (currentObj === undefined) {
                    break;
                }
                currentObj = currentObj[prop];
            }

            const value = parseIntWithDefault(currentObj, descriptor.defaultValue);
            return <div key={index} className="">
                <span>{descriptor.desc}&nbsp;</span>
                <PowerSelector
                    value={value}
                    usersDefault={defaultUserLevel}
                    controlled={false}
                    disabled={!canChangeLevels || currentUserLevel < value}
                    powerLevelKey={key} // Will be sent as the second parameter to `onChange`
                    onChange={this._onPowerLevelsChanged}
                />
            </div>;
        });

        const eventPowerSelectors = Object.keys(eventsLevels).map((eventType, i) => {
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
                <div className="" key={eventType}>
                    <span>{label}&nbsp;</span>
                    <PowerSelector
                        value={eventsLevels[eventType]}
                        usersDefault={defaultUserLevel}
                        controlled={false}
                        disabled={!canChangeLevels || currentUserLevel < eventsLevels[eventType]}
                        powerLevelKey={"event_levels_" + eventType}
                        onChange={this._onPowerLevelsChanged}
                    />
                </div>
            );
        });

        return (
            <div className="mx_SettingsTab mx_RolesRoomSettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Roles & Permissions")}</div>
                {privilegedUsersSection}
                {mutedUsersSection}
                {bannedUsersSection}
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    <span className='mx_SettingsTab_subheading'>{_t("Permissions")}</span>
                    {powerSelectors}
                    {eventPowerSelectors}
                </div>
            </div>
        );
    }
}

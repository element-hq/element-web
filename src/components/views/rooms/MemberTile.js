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

import SettingsStore from "../../../settings/SettingsStore";

const React = require('react');
import PropTypes from 'prop-types';

const sdk = require('../../../index');
const dis = require('../../../dispatcher');
import { _t } from '../../../languageHandler';

module.exports = React.createClass({
    displayName: 'MemberTile',

    propTypes: {
        member: PropTypes.any.isRequired, // RoomMember
        showPresence: PropTypes.bool,
    },

    getDefaultProps: function() {
        return {
            showPresence: true,
        };
    },

    getInitialState: function() {
        return {
            statusMessage: this.getStatusMessage(),
        };
    },

    componentDidMount() {
        if (!SettingsStore.isFeatureEnabled("feature_custom_status")) {
            return;
        }
        const { user } = this.props.member;
        if (!user) {
            return;
        }
        user.on("User._unstable_statusMessage", this._onStatusMessageCommitted);
    },

    componentWillUnmount() {
        const { user } = this.props.member;
        if (!user) {
            return;
        }
        user.removeListener(
            "User._unstable_statusMessage",
            this._onStatusMessageCommitted,
        );
    },

    getStatusMessage() {
        const { user } = this.props.member;
        if (!user) {
            return "";
        }
        return user._unstable_statusMessage;
    },

    _onStatusMessageCommitted() {
        // The `User` object has observed a status message change.
        this.setState({
            statusMessage: this.getStatusMessage(),
        });
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        if (
            this.member_last_modified_time === undefined ||
            this.member_last_modified_time < nextProps.member.getLastModifiedTime()
        ) {
            return true;
        }
        if (
            nextProps.member.user &&
            (this.user_last_modified_time === undefined ||
            this.user_last_modified_time < nextProps.member.user.getLastModifiedTime())
        ) {
            return true;
        }
        return false;
    },

    onClick: function(e) {
        dis.dispatch({
            action: 'view_user',
            member: this.props.member,
        });
    },

    _getDisplayName: function() {
        return this.props.member.name;
    },

    getPowerLabel: function() {
        return _t("%(userName)s (power %(powerLevelNumber)s)", {
            userName: this.props.member.userId,
            powerLevelNumber: this.props.member.powerLevel,
        });
    },

    render: function() {
        const MemberAvatar = sdk.getComponent('avatars.MemberAvatar');
        const EntityTile = sdk.getComponent('rooms.EntityTile');

        const member = this.props.member;
        const name = this._getDisplayName();
        const presenceState = member.user ? member.user.presence : null;

        let statusMessage = null;
        if (member.user && SettingsStore.isFeatureEnabled("feature_custom_status")) {
            statusMessage = this.state.statusMessage;
        }

        const av = (
            <MemberAvatar member={member} width={36} height={36} />
        );

        if (member.user) {
            this.user_last_modified_time = member.user.getLastModifiedTime();
        }
        this.member_last_modified_time = member.getLastModifiedTime();

        const powerStatusMap = new Map([
            [100, EntityTile.POWER_STATUS_ADMIN],
            [50, EntityTile.POWER_STATUS_MODERATOR],
        ]);

        // Find the nearest power level with a badge
        let powerLevel = this.props.member.powerLevel;
        for (const [pl] of powerStatusMap) {
            if (this.props.member.powerLevel >= pl) {
                powerLevel = pl;
                break;
            }
        }

        const powerStatus = powerStatusMap.get(powerLevel);

        return (
            <EntityTile {...this.props} presenceState={presenceState}
                presenceLastActiveAgo={member.user ? member.user.lastActiveAgo : 0}
                presenceLastTs={member.user ? member.user.lastPresenceTs : 0}
                presenceCurrentlyActive={member.user ? member.user.currentlyActive : false}
                avatarJsx={av} title={this.getPowerLabel()} onClick={this.onClick}
                name={name} powerStatus={powerStatus} showPresence={this.props.showPresence}
                subtextLabel={statusMessage}
            />
        );
    },
});

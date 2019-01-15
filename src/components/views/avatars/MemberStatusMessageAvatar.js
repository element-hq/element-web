/*
Copyright 2018 New Vector Ltd

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
import MatrixClientPeg from '../../../MatrixClientPeg';
import AccessibleButton from '../elements/AccessibleButton';
import MemberAvatar from '../avatars/MemberAvatar';
import classNames from 'classnames';
import * as ContextualMenu from "../../structures/ContextualMenu";
import StatusMessageContextMenu from "../context_menus/StatusMessageContextMenu";
import SettingsStore from "../../../settings/SettingsStore";

export default class MemberStatusMessageAvatar extends React.Component {
    static propTypes = {
        member: PropTypes.object.isRequired,
        width: PropTypes.number,
        height: PropTypes.number,
        resizeMethod: PropTypes.string,
    };

    static defaultProps = {
        width: 40,
        height: 40,
        resizeMethod: 'crop',
    };

    constructor(props, context) {
        super(props, context);

        this.state = {
            hasStatus: this.hasStatus,
        };
    }

    componentWillMount() {
        if (this.props.member.userId !== MatrixClientPeg.get().getUserId()) {
            throw new Error("Cannot use MemberStatusMessageAvatar on anyone but the logged in user");
        }
        if (!SettingsStore.isFeatureEnabled("feature_custom_status")) {
            return;
        }
        const { user } = this.props.member;
        if (!user) {
            return;
        }
        user.on("User._unstable_statusMessage", this._onStatusMessageCommitted);
    }

    componentWillUmount() {
        const { user } = this.props.member;
        if (!user) {
            return;
        }
        user.removeListener(
            "User._unstable_statusMessage",
            this._onStatusMessageCommitted,
        );
    }

    get hasStatus() {
        const { user } = this.props.member;
        if (!user) {
            return false;
        }
        return !!user._unstable_statusMessage;
    }

    _onStatusMessageCommitted = () => {
        // The `User` object has observed a status message change.
        this.setState({
            hasStatus: this.hasStatus,
        });
    };

    _onClick = (e) => {
        e.stopPropagation();

        const elementRect = e.target.getBoundingClientRect();

        const x = (elementRect.left + window.pageXOffset);
        const chevronWidth = 16; // See .mx_ContextualMenu_chevron_bottom
        const chevronOffset = (elementRect.width - chevronWidth) / 2;
        const chevronMargin = 1; // Add some spacing away from target
        const y = elementRect.top + window.pageYOffset - chevronMargin;

        ContextualMenu.createMenu(StatusMessageContextMenu, {
            chevronOffset: chevronOffset,
            chevronFace: 'bottom',
            left: x,
            top: y,
            menuWidth: 226,
            user: this.props.member.user,
        });
    };

    render() {
        const avatar = <MemberAvatar
            member={this.props.member}
            width={this.props.width}
            height={this.props.height}
            resizeMethod={this.props.resizeMethod}
        />;

        if (!SettingsStore.isFeatureEnabled("feature_custom_status")) {
            return avatar;
        }

        const classes = classNames({
            "mx_MemberStatusMessageAvatar": true,
            "mx_MemberStatusMessageAvatar_hasStatus": this.state.hasStatus,
        });

        return <AccessibleButton className={classes}
            element="div" onClick={this._onClick}
        >
            {avatar}
        </AccessibleButton>;
    }
}

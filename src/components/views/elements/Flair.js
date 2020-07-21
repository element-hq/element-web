/*
 Copyright 2017 New Vector Ltd.

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

import React from 'react';
import PropTypes from 'prop-types';
import FlairStore from '../../../stores/FlairStore';
import dis from '../../../dispatcher/dispatcher';
import MatrixClientContext from "../../../contexts/MatrixClientContext";


class FlairAvatar extends React.Component {
    constructor() {
        super();
        this.onClick = this.onClick.bind(this);
    }

    onClick(ev) {
        ev.preventDefault();
        // Don't trigger onClick of parent element
        ev.stopPropagation();
        dis.dispatch({
            action: 'view_group',
            group_id: this.props.groupProfile.groupId,
        });
    }

    render() {
        const httpUrl = this.context.mxcUrlToHttp(
            this.props.groupProfile.avatarUrl, 16, 16, 'scale', false);
        const tooltip = this.props.groupProfile.name ?
            `${this.props.groupProfile.name} (${this.props.groupProfile.groupId})`:
            this.props.groupProfile.groupId;
        return <img
            src={httpUrl}
            width="16"
            height="16"
            onClick={this.onClick}
            title={tooltip} />;
    }
}

FlairAvatar.propTypes = {
    groupProfile: PropTypes.shape({
        groupId: PropTypes.string.isRequired,
        name: PropTypes.string,
        avatarUrl: PropTypes.string.isRequired,
    }),
};

FlairAvatar.contextType = MatrixClientContext;

export default class Flair extends React.Component {
    constructor() {
        super();
        this.state = {
            profiles: [],
        };
    }

    componentDidMount() {
        this._unmounted = false;
        this._generateAvatars(this.props.groups);
    }

    componentWillUnmount() {
        this._unmounted = true;
    }

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    UNSAFE_componentWillReceiveProps(newProps) {  // eslint-disable-line camelcase
        this._generateAvatars(newProps.groups);
    }

    async _getGroupProfiles(groups) {
        const profiles = [];
        for (const groupId of groups) {
            let groupProfile = null;
            try {
                groupProfile = await FlairStore.getGroupProfileCached(this.context, groupId);
            } catch (err) {
                console.error('Could not get profile for group', groupId, err);
            }
            profiles.push(groupProfile);
        }
        return profiles.filter((p) => p !== null);
    }

    async _generateAvatars(groups) {
        if (!groups || groups.length === 0) {
            return;
        }
        const profiles = await this._getGroupProfiles(groups);
        if (!this.unmounted) {
            this.setState({
                profiles: profiles.filter((profile) => {
                    return profile ? profile.avatarUrl : false;
                }),
            });
        }
    }

    render() {
        if (this.state.profiles.length === 0) {
            return <span className="mx_Flair" />;
        }
        const avatars = this.state.profiles.map((profile, index) => {
            return <FlairAvatar key={index} groupProfile={profile} />;
        });
        return (
            <span className="mx_Flair">
                { avatars }
            </span>
        );
    }
}

Flair.propTypes = {
    groups: PropTypes.arrayOf(PropTypes.string),
};

Flair.contextType = MatrixClientContext;

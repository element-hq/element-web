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
import {MatrixClient} from 'matrix-js-sdk';
import UserSettingsStore from '../../../UserSettingsStore';
import FlairStore from '../../../stores/FlairStore';
import dis from '../../../dispatcher';


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
        const httpUrl = this.context.matrixClient.mxcUrlToHttp(
            this.props.groupProfile.avatarUrl, 14, 14, 'scale', false);
        return <img
            src={httpUrl}
            width="14px"
            height="14px"
            onClick={this.onClick}
            title={this.props.groupProfile.groupId} />;
    }
}

FlairAvatar.propTypes = {
    groupProfile: PropTypes.shape({
        groupId: PropTypes.string.isRequired,
        avatarUrl: PropTypes.string.isRequired,
    }),
};

FlairAvatar.contextTypes = {
    matrixClient: React.PropTypes.instanceOf(MatrixClient).isRequired,
};

export default class Flair extends React.Component {
    constructor() {
        super();
        this.state = {
            profiles: [],
        };
        this.onRoomStateEvents = this.onRoomStateEvents.bind(this);
    }

    componentWillUnmount() {
        this._unmounted = true;
        this.context.matrixClient.removeListener('RoomState.events', this.onRoomStateEvents);
    }

    componentWillMount() {
        this._unmounted = false;
        if (UserSettingsStore.isFeatureEnabled('feature_groups') && FlairStore.groupSupport()) {
            this._generateAvatars();
        }
        this.context.matrixClient.on('RoomState.events', this.onRoomStateEvents);
    }

    onRoomStateEvents(event) {
        if (event.getType() === 'm.room.related_groups' && FlairStore.groupSupport()) {
            this._generateAvatars();
        }
    }

    async _getGroupProfiles(groups) {
        const profiles = [];
        for (const groupId of groups) {
            let groupProfile = null;
            try {
                groupProfile = await FlairStore.getGroupProfileCached(this.context.matrixClient, groupId);
            } catch (err) {
                console.error('Could not get profile for group', groupId, err);
            }
            profiles.push(groupProfile);
        }
        return profiles.filter((p) => p !== null);
    }

    async _generateAvatars() {
        let groups = await FlairStore.getPublicisedGroupsCached(this.context.matrixClient, this.props.userId);
        if (this.props.roomId && this.props.showRelated) {
            const relatedGroupsEvent = this.context.matrixClient
                .getRoom(this.props.roomId)
                .currentState
                .getStateEvents('m.room.related_groups', '');
            console.info('relatedGroupsEvent', relatedGroupsEvent);
            const relatedGroups = relatedGroupsEvent ?
                relatedGroupsEvent.getContent().groups || [] : [];
            if (relatedGroups && relatedGroups.length > 0) {
                groups = groups.filter((groupId) => {
                    return relatedGroups.includes(groupId);
                });
            } else {
                groups = [];
            }
        }
        if (!groups || groups.length === 0) {
            return;
        }
        const profiles = await this._getGroupProfiles(groups);
        if (!this.unmounted) {
            this.setState({profiles});
        }
    }

    render() {
        if (this.state.profiles.length === 0) {
            return <div />;
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
    userId: PropTypes.string,

    // Whether to show only the flair associated with related groups of the given room,
    // or all flair associated with a user.
    showRelated: PropTypes.bool,
    // The room that this flair will be displayed in. Optional. Only applies when showRelated = true.
    roomId: PropTypes.string,
};

// TODO: We've decided that all components should follow this pattern, which means removing withMatrixClient and using
// this.context.matrixClient everywhere instead of this.props.matrixClient.
// See https://github.com/vector-im/riot-web/issues/4951.
Flair.contextTypes = {
    matrixClient: React.PropTypes.instanceOf(MatrixClient).isRequired,
};

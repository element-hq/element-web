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
import dis from '../../../dispatcher';
import Promise from 'bluebird';

const BULK_REQUEST_DEBOUNCE_MS = 200;

// Does the server support groups? Assume yes until we receive M_UNRECOGNIZED.
// If true, flair can function and we should keep sending requests for groups and avatars.
let groupSupport = true;

const USER_GROUPS_CACHE_BUST_MS = 1800000; // 30 mins
const GROUP_PROFILES_CACHE_BUST_MS = 1800000; // 30 mins

// TODO: Cache-busting based on time. (The server won't inform us of membership changes.)
// This applies to userGroups and groupProfiles. We can provide a slightly better UX by
// cache-busting when the current user joins/leaves a group.
const userGroups = {
    // $userId: ['+group1:domain', '+group2:domain', ...]
};

const groupProfiles = {
//  $groupId: {
//      avatar_url: 'mxc://...'
//  }
};

// Represents all unsettled promises to retrieve the groups for each userId. When a promise
// is settled, it is deleted from this object.
const usersPending = {
//  $userId: {
//      prom: Promise
//      resolve: () => {}
//      reject: () => {}
//  }
};

let debounceTimeoutID;
function getPublicisedGroupsCached(matrixClient, userId) {
    if (userGroups[userId]) {
        return Promise.resolve(userGroups[userId]);
    }

    // Bulk lookup ongoing, return promise to resolve/reject
    if (usersPending[userId]) {
        return usersPending[userId].prom;
    }

    usersPending[userId] = {};
    usersPending[userId].prom = new Promise((resolve, reject) => {
        usersPending[userId].resolve = resolve;
        usersPending[userId].reject = reject;
    }).then((groups) => {
        userGroups[userId] = groups;
        setTimeout(() => {
            delete userGroups[userId];
        }, USER_GROUPS_CACHE_BUST_MS);
        return userGroups[userId];
    }).catch((err) => {
        throw err;
    }).finally(() => {
        delete usersPending[userId];
    });

    // This debounce will allow consecutive requests for the public groups of users that
    // are sent in intervals of < BULK_REQUEST_DEBOUNCE_MS to be batched and only requested
    // when no more requests are received within the next BULK_REQUEST_DEBOUNCE_MS. The naive
    // implementation would do a request that only requested the groups for `userId`, leading
    // to a worst and best case of 1 user per request. This implementation's worst is still
    // 1 user per request but only if the requests are > BULK_REQUEST_DEBOUNCE_MS apart and the
    // best case is N users per request.
    //
    // This is to reduce the number of requests made whilst trading off latency when viewing
    // a Flair component.
    if (debounceTimeoutID) clearTimeout(debounceTimeoutID);
    debounceTimeoutID = setTimeout(() => {
        batchedGetPublicGroups(matrixClient);
    }, BULK_REQUEST_DEBOUNCE_MS);

    return usersPending[userId].prom;
}

async function batchedGetPublicGroups(matrixClient) {
    // Take the userIds from the keys of usersPending
    const usersInFlight = Object.keys(usersPending);
    let resp = {
        users: [],
    };
    try {
        resp = await matrixClient.getPublicisedGroups(usersInFlight);
    } catch (err) {
        // Propagate the same error to all usersInFlight
        usersInFlight.forEach((userId) => {
            usersPending[userId].reject(err);
        });
        return;
    }
    const updatedUserGroups = resp.users;
    usersInFlight.forEach((userId) => {
        usersPending[userId].resolve(updatedUserGroups[userId] || []);
    });
}

async function getGroupProfileCached(matrixClient, groupId) {
    if (groupProfiles[groupId]) {
        return groupProfiles[groupId];
    }

    const profile = await matrixClient.getGroupProfile(groupId);
    groupProfiles[groupId] = {
        groupId,
        avatarUrl: profile.avatar_url,
    };
    setTimeout(() => {
        delete groupProfiles[groupId];
    }, GROUP_PROFILES_CACHE_BUST_MS);

    return groupProfiles[groupId];
}

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
        if (UserSettingsStore.isFeatureEnabled('feature_groups') && groupSupport) {
            this._generateAvatars();
        }
        this.context.matrixClient.on('RoomState.events', this.onRoomStateEvents);
    }

    onRoomStateEvents(event) {
        if (event.getType() === 'm.room.related_groups' && groupSupport) {
            this._generateAvatars();
        }
    }

    async _getGroupProfiles(groups) {
        const profiles = [];
        for (const groupId of groups) {
            let groupProfile = null;
            try {
                groupProfile = await getGroupProfileCached(this.context.matrixClient, groupId);
            } catch (err) {
                console.error('Could not get profile for group', groupId, err);
            }
            profiles.push(groupProfile);
        }
        return profiles.filter((p) => p !== null);
    }

    async _generateAvatars() {
        let groups;
        try {
            groups = await getPublicisedGroupsCached(this.context.matrixClient, this.props.userId);
        } catch (err) {
            // Indicate whether the homeserver supports groups
            if (err.errcode === 'M_UNRECOGNIZED') {
                console.warn('Cannot display flair, server does not support groups');
                groupSupport = false;
                // Return silently to avoid spamming for non-supporting servers
                return;
            }
            console.error('Could not get groups for user', this.props.userId, err);
        }
        if (this.props.roomId && this.props.showRelated) {
            const relatedGroupsEvent = this.context.matrixClient
                .getRoom(this.props.roomId)
                .currentState
                .getStateEvents('m.room.related_groups', '');
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
            <span className="mx_Flair" style={{"marginLeft": "5px", "verticalAlign": "-3px"}}>
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

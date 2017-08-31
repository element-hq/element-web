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

const BULK_REQUEST_DEBOUNCE_MS = 200;

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
function getPublicGroupsCached(matrixClient, userId) {
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
        // TODO: Reset cache at this point
        return userGroups[userId];
    }).catch((err) => {
        throw err;
    }).finally(() => {
        delete usersPending[userId];
    });

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
        resp = await matrixClient.getPublicGroups(usersInFlight);
    } catch (err) {
        // Propagate the same error to all usersInFlight
        usersInFlight.forEach((userId) => {
            usersPending[userId].prom.reject(err);
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

    groupProfiles[groupId] = await matrixClient.getGroupProfile(groupId);
    return groupProfiles[groupId];
}

export default class Flair extends React.Component {
    constructor() {
        super();
        this.state = {
            avatarUrls: [],
        };
    }

    componentWillUnmount() {
        this._unmounted = true;
    }

    componentWillMount() {
        this._unmounted = false;
        this._generateAvatars();
    }

    async _getAvatarUrls(groups) {
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

        const avatarUrls = profiles.filter((p) => p !== null).map((p) => p.avatar_url);
        return avatarUrls;
    }

    async _generateAvatars() {
        let groups;
        try {
            groups = await getPublicGroupsCached(this.context.matrixClient, this.props.userId);
        } catch (err) {
            console.error('Could not get groups for user', this.props.userId, err);
        }
        const avatarUrls = await this._getAvatarUrls(groups);
        if (!this.unmounted) {
            this.setState({avatarUrls});
        }
    }

    render() {
        if (this.state.avatarUrls.length === 0) {
            return <div />;
        }
        const avatars = this.state.avatarUrls.map((avatarUrl, index) => {
            const httpUrl = this.context.matrixClient.mxcUrlToHttp(avatarUrl, 14, 14, 'scale', false);
            return <img key={index} src={httpUrl} width="14px" height="14px"/>;
        });
        return (
            <span className="mx_Flair" style={{"marginLeft": "5px", "verticalAlign": "-3px"}}>
                {avatars}
            </span>
        );
    }
}

Flair.propTypes = {
    userId: PropTypes.string,
};

Flair.contextTypes = {
    matrixClient: React.PropTypes.instanceOf(MatrixClient).isRequired,
};

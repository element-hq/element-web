/*
Copyright 2017 New Vector Ltd

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

import EventEmitter from 'events';

const BULK_REQUEST_DEBOUNCE_MS = 200;

// Does the server support groups? Assume yes until we receive M_UNRECOGNIZED.
// If true, flair can function and we should keep sending requests for groups and avatars.
let groupSupport = true;

const USER_GROUPS_CACHE_BUST_MS = 1800000; // 30 mins
const GROUP_PROFILES_CACHE_BUST_MS = 1800000; // 30 mins

/**
 * Stores data used by <Flair/>
 */
class FlairStore extends EventEmitter {
    constructor(matrixClient) {
        super();
        this._matrixClient = matrixClient;
        this._userGroups = {
            // $userId: ['+group1:domain', '+group2:domain', ...]
        };
        this._groupProfiles = {
            //  $groupId: {
            //      avatar_url: 'mxc://...'
            //  }
        };
        this._groupProfilesPromise = {
            //  $groupId: Promise
        };
        this._usersPending = {
            //  $userId: {
            //      prom: Promise
            //      resolve: () => {}
            //      reject: () => {}
            //  }
        };
        this._usersInFlight = {
            // This has the same schema as _usersPending
        };

        this._debounceTimeoutID = null;
    }

    groupSupport() {
        return groupSupport;
    }

    invalidatePublicisedGroups(userId) {
        delete this._userGroups[userId];
    }

    getPublicisedGroupsCached(matrixClient, userId) {
        if (this._userGroups[userId]) {
            return Promise.resolve(this._userGroups[userId]);
        }

        // Bulk lookup ongoing, return promise to resolve/reject
        if (this._usersPending[userId]) {
            return this._usersPending[userId].prom;
        }
        // User has been moved from pending to in-flight
        if (this._usersInFlight[userId]) {
            return this._usersInFlight[userId].prom;
        }

        this._usersPending[userId] = {};
        this._usersPending[userId].prom = new Promise((resolve, reject) => {
            this._usersPending[userId].resolve = resolve;
            this._usersPending[userId].reject = reject;
        }).then((groups) => {
            this._userGroups[userId] = groups;
            setTimeout(() => {
                delete this._userGroups[userId];
            }, USER_GROUPS_CACHE_BUST_MS);
            return this._userGroups[userId];
        }).catch((err) => {
            // Indicate whether the homeserver supports groups
            if (err.errcode === 'M_UNRECOGNIZED') {
                console.warn('Cannot display flair, server does not support groups');
                groupSupport = false;
                // Return silently to avoid spamming for non-supporting servers
                return;
            }
            console.error('Could not get groups for user', userId, err);
            throw err;
        }).finally(() => {
            delete this._usersInFlight[userId];
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
        if (this._debounceTimeoutID) clearTimeout(this._debounceTimeoutID);
        this._debounceTimeoutID = setTimeout(() => {
            this._batchedGetPublicGroups(matrixClient);
        }, BULK_REQUEST_DEBOUNCE_MS);

        return this._usersPending[userId].prom;
    }

    async _batchedGetPublicGroups(matrixClient) {
        // Move users pending to users in flight
        this._usersInFlight = this._usersPending;
        this._usersPending = {};

        let resp = {
            users: [],
        };
        try {
            resp = await matrixClient.getPublicisedGroups(Object.keys(this._usersInFlight));
        } catch (err) {
            // Propagate the same error to all usersInFlight
            Object.keys(this._usersInFlight).forEach((userId) => {
                // The promise should always exist for userId, but do a null-check anyway
                if (!this._usersInFlight[userId]) return;
                this._usersInFlight[userId].reject(err);
            });
            return;
        }
        const updatedUserGroups = resp.users;
        Object.keys(this._usersInFlight).forEach((userId) => {
            // The promise should always exist for userId, but do a null-check anyway
            if (!this._usersInFlight[userId]) return;
            this._usersInFlight[userId].resolve(updatedUserGroups[userId] || []);
        });
    }

    async getGroupProfileCached(matrixClient, groupId) {
        if (this._groupProfiles[groupId]) {
            return this._groupProfiles[groupId];
        }

        // A request is ongoing, wait for it to complete and return the group profile.
        if (this._groupProfilesPromise[groupId]) {
            try {
                await this._groupProfilesPromise[groupId];
            } catch (e) {
                // Don't log the error; this is done below
                return null;
            }
            return this._groupProfiles[groupId];
        }

        // No request yet, start one
        console.log('FlairStore: Request group profile of ' + groupId);
        this._groupProfilesPromise[groupId] = matrixClient.getGroupProfile(groupId);

        let profile;
        try {
            profile = await this._groupProfilesPromise[groupId];
        } catch (e) {
            console.log('FlairStore: Failed to get group profile for ' + groupId, e);
            // Don't retry, but allow a retry when the profile is next requested
            delete this._groupProfilesPromise[groupId];
            return null;
        }

        this._groupProfiles[groupId] = {
            groupId,
            avatarUrl: profile.avatar_url,
            name: profile.name,
            shortDescription: profile.short_description,
        };
        delete this._groupProfilesPromise[groupId];

        /// XXX: This is verging on recreating a third "Flux"-looking Store. We really
        /// should replace FlairStore with a Flux store and some async actions.
        console.log('FlairStore: Emit updateGroupProfile for ' + groupId);
        this.emit('updateGroupProfile');

        setTimeout(() => {
            this.refreshGroupProfile(matrixClient, groupId);
        }, GROUP_PROFILES_CACHE_BUST_MS);

        return this._groupProfiles[groupId];
    }

    refreshGroupProfile(matrixClient, groupId) {
        // Invalidate the cache
        delete this._groupProfiles[groupId];
        // Fetch new profile data, and cache it
        return this.getGroupProfileCached(matrixClient, groupId);
    }
}

if (global.singletonFlairStore === undefined) {
    global.singletonFlairStore = new FlairStore();
}
export default global.singletonFlairStore;

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
import { groupMemberFromApiObject, groupRoomFromApiObject } from '../groups';
import FlairStore from './FlairStore';
import MatrixClientPeg from '../MatrixClientPeg';

function parseMembersResponse(response) {
    return response.chunk.map((apiMember) => groupMemberFromApiObject(apiMember));
}

function parseRoomsResponse(response) {
    return response.chunk.map((apiRoom) => groupRoomFromApiObject(apiRoom));
}

// The number of ongoing group requests
let ongoingRequestCount = 0;

// This has arbitrarily been set to a small number to lower the priority
// of doing group-related requests because we care about other important
// requests like hitting /sync.
const LIMIT = 3; // Maximum number of ongoing group requests

// FIFO queue of functions to call in the backlog
const backlogQueue = [
    // () => {...}
];

// Pull from the FIFO queue
function checkBacklog() {
    const item = backlogQueue.shift();
    if (typeof item === 'function') item();
}

// Limit the maximum number of ongoing promises returned by fn to LIMIT and
// use a FIFO queue to handle the backlog.
function limitConcurrency(fn) {
    return new Promise((resolve, reject) => {
        const item = () => {
            ongoingRequestCount++;
            resolve();
        };
        if (ongoingRequestCount >= LIMIT) {
            // Enqueue this request for later execution
            backlogQueue.push(item);
        } else {
            item();
        }
    })
    .then(fn)
    .then((result) => {
        ongoingRequestCount--;
        checkBacklog();
        return result;
    });
}

/**
 * Stores the group summary for a room and provides an API to change it and
 * other useful group APIs that may have an effect on the group summary.
 */
export default class GroupStore extends EventEmitter {

    static STATE_KEY = {
        GroupMembers: 'GroupMembers',
        GroupInvitedMembers: 'GroupInvitedMembers',
        Summary: 'Summary',
        GroupRooms: 'GroupRooms',
    };

    constructor(groupId) {
        super();
        if (!groupId) {
            throw new Error('GroupStore needs a valid groupId to be created');
        }
        this.groupId = groupId;
        this._state = {};
        this._state[GroupStore.STATE_KEY.Summary] = {};
        this._state[GroupStore.STATE_KEY.GroupRooms] = [];
        this._state[GroupStore.STATE_KEY.GroupMembers] = [];
        this._state[GroupStore.STATE_KEY.GroupInvitedMembers] = [];
        this._ready = {};

        this._fetchResourcePromise = {};
        this._resourceFetcher = {
            [GroupStore.STATE_KEY.Summary]: () => {
                return limitConcurrency(
                    () => MatrixClientPeg.get().getGroupSummary(this.groupId),
                );
            },
            [GroupStore.STATE_KEY.GroupRooms]: () => {
                return limitConcurrency(
                    () => MatrixClientPeg.get().getGroupRooms(this.groupId).then(parseRoomsResponse),
                );
            },
            [GroupStore.STATE_KEY.GroupMembers]: () => {
                return limitConcurrency(
                    () => MatrixClientPeg.get().getGroupUsers(this.groupId).then(parseMembersResponse),
                );
            },
            [GroupStore.STATE_KEY.GroupInvitedMembers]: () => {
                return limitConcurrency(
                    () => MatrixClientPeg.get().getGroupInvitedUsers(this.groupId).then(parseMembersResponse),
                );
            },
        };

        this.on('error', (err) => {
            console.error(`GroupStore for ${this.groupId} encountered error`, err);
        });
    }

    _fetchResource(stateKey) {
        // Ongoing request, ignore
        if (this._fetchResourcePromise[stateKey]) return;

        const clientPromise = this._resourceFetcher[stateKey]();

        // Indicate ongoing request
        this._fetchResourcePromise[stateKey] = clientPromise;

        clientPromise.then((result) => {
            this._state[stateKey] = result;
            this._ready[stateKey] = true;
            this._notifyListeners();
        }).catch((err) => {
            // Invited users not visible to non-members
            if (stateKey === GroupStore.STATE_KEY.GroupInvitedMembers && err.httpStatus === 403) {
                return;
            }

            console.error("Failed to get resource " + stateKey + ":" + err);
            this.emit('error', err);
        }).finally(() => {
            // Indicate finished request, allow for future fetches
            delete this._fetchResourcePromise[stateKey];
        });

        return clientPromise;
    }

    _notifyListeners() {
        this.emit('update');
    }

    /**
     * Register a listener to recieve updates from the store. This also
     * immediately triggers an update to send the current state of the
     * store (which could be the initial state).
     *
     * This also causes a fetch of all group data, which might cause
     * 4 separate HTTP requests, but only said requests aren't already
     * ongoing.
     *
     * @param {function} fn the function to call when the store updates.
     * @return {Object} tok a registration "token" with a single
     *                      property `unregister`, a function that can
     *                      be called to unregister the listener such
     *                      that it won't be called any more.
     */
    registerListener(fn) {
        this.on('update', fn);
        // Call to set initial state (before fetching starts)
        this.emit('update');

        this._fetchResource(GroupStore.STATE_KEY.Summary);
        this._fetchResource(GroupStore.STATE_KEY.GroupRooms);
        this._fetchResource(GroupStore.STATE_KEY.GroupMembers);
        this._fetchResource(GroupStore.STATE_KEY.GroupInvitedMembers);

        // Similar to the Store of flux/utils, we return a "token" that
        // can be used to unregister the listener.
        return {
            unregister: () => {
                this.unregisterListener(fn);
            },
        };
    }

    unregisterListener(fn) {
        this.removeListener('update', fn);
    }

    isStateReady(id) {
        return this._ready[id];
    }

    getSummary() {
        return this._state[GroupStore.STATE_KEY.Summary];
    }

    getGroupRooms() {
        return this._state[GroupStore.STATE_KEY.GroupRooms];
    }

    getGroupMembers() {
        return this._state[GroupStore.STATE_KEY.GroupMembers];
    }

    getGroupInvitedMembers() {
        return this._state[GroupStore.STATE_KEY.GroupInvitedMembers];
    }

    getGroupPublicity() {
        return this._state[GroupStore.STATE_KEY.Summary].user ?
            this._state[GroupStore.STATE_KEY.Summary].user.is_publicised : null;
    }

    isUserPrivileged() {
        return this._state[GroupStore.STATE_KEY.Summary].user ?
            this._state[GroupStore.STATE_KEY.Summary].user.is_privileged : null;
    }

    addRoomToGroup(roomId, isPublic) {
        return MatrixClientPeg.get()
            .addRoomToGroup(this.groupId, roomId, isPublic)
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.GroupRooms));
    }

    updateGroupRoomVisibility(roomId, isPublic) {
        return MatrixClientPeg.get()
            .updateGroupRoomVisibility(this.groupId, roomId, isPublic)
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.GroupRooms));
    }

    removeRoomFromGroup(roomId) {
        return MatrixClientPeg.get()
            .removeRoomFromGroup(this.groupId, roomId)
            // Room might be in the summary, refresh just in case
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.Summary))
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.GroupRooms));
    }

    inviteUserToGroup(userId) {
        return MatrixClientPeg.get().inviteUserToGroup(this.groupId, userId)
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.GroupInvitedMembers));
    }

    acceptGroupInvite() {
        return MatrixClientPeg.get().acceptGroupInvite(this.groupId)
            // The user should now be able to access (personal) group settings
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.Summary))
            // The user might be able to see more rooms now
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.GroupRooms))
            // The user should now appear as a member
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.GroupMembers))
            // The user should now not appear as an invited member
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.GroupInvitedMembers));
    }

    joinGroup() {
        return MatrixClientPeg.get().joinGroup(this.groupId)
            // The user should now be able to access (personal) group settings
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.Summary))
            // The user might be able to see more rooms now
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.GroupRooms))
            // The user should now appear as a member
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.GroupMembers))
            // The user should now not appear as an invited member
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.GroupInvitedMembers));
    }

    leaveGroup() {
        return MatrixClientPeg.get().leaveGroup(this.groupId)
            // The user should now not be able to access group settings
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.Summary))
            // The user might only be able to see a subset of rooms now
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.GroupRooms))
            // The user should now not appear as a member
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.GroupMembers));
    }

    addRoomToGroupSummary(roomId, categoryId) {
        return MatrixClientPeg.get()
            .addRoomToGroupSummary(this.groupId, roomId, categoryId)
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.Summary));
    }

    addUserToGroupSummary(userId, roleId) {
        return MatrixClientPeg.get()
            .addUserToGroupSummary(this.groupId, userId, roleId)
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.Summary));
    }

    removeRoomFromGroupSummary(roomId) {
        return MatrixClientPeg.get()
            .removeRoomFromGroupSummary(this.groupId, roomId)
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.Summary));
    }

    removeUserFromGroupSummary(userId) {
        return MatrixClientPeg.get()
            .removeUserFromGroupSummary(this.groupId, userId)
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.Summary));
    }

    setGroupPublicity(isPublished) {
        return MatrixClientPeg.get()
            .setGroupPublicity(this.groupId, isPublished)
            .then(() => { FlairStore.invalidatePublicisedGroups(MatrixClientPeg.get().credentials.userId); })
            .then(this._fetchResource.bind(this, GroupStore.STATE_KEY.Summary));
    }
}

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
import {MatrixClientPeg} from '../MatrixClientPeg';
import dis from '../dispatcher/dispatcher';

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
async function limitConcurrency(fn) {
    if (ongoingRequestCount >= LIMIT) {
        // Enqueue this request for later execution
        await new Promise((resolve, reject) => {
            backlogQueue.push(resolve);
        });
    }

    ongoingRequestCount++;
    try {
        return await fn();
    } catch (err) {
        // We explicitly do not handle the error here, but let it propogate.
        throw err;
    } finally {
        ongoingRequestCount--;
        checkBacklog();
    }
}

/**
 * Global store for tracking group summary, members, invited members and rooms.
 */
class GroupStore extends EventEmitter {
    STATE_KEY = {
        GroupMembers: 'GroupMembers',
        GroupInvitedMembers: 'GroupInvitedMembers',
        Summary: 'Summary',
        GroupRooms: 'GroupRooms',
    };

    constructor() {
        super();
        this._state = {};
        this._state[this.STATE_KEY.Summary] = {};
        this._state[this.STATE_KEY.GroupRooms] = {};
        this._state[this.STATE_KEY.GroupMembers] = {};
        this._state[this.STATE_KEY.GroupInvitedMembers] = {};

        this._ready = {};
        this._ready[this.STATE_KEY.Summary] = {};
        this._ready[this.STATE_KEY.GroupRooms] = {};
        this._ready[this.STATE_KEY.GroupMembers] = {};
        this._ready[this.STATE_KEY.GroupInvitedMembers] = {};

        this._fetchResourcePromise = {
            [this.STATE_KEY.Summary]: {},
            [this.STATE_KEY.GroupRooms]: {},
            [this.STATE_KEY.GroupMembers]: {},
            [this.STATE_KEY.GroupInvitedMembers]: {},
        };

        this._resourceFetcher = {
            [this.STATE_KEY.Summary]: (groupId) => {
                return limitConcurrency(
                    () => MatrixClientPeg.get().getGroupSummary(groupId),
                );
            },
            [this.STATE_KEY.GroupRooms]: (groupId) => {
                return limitConcurrency(
                    () => MatrixClientPeg.get().getGroupRooms(groupId).then(parseRoomsResponse),
                );
            },
            [this.STATE_KEY.GroupMembers]: (groupId) => {
                return limitConcurrency(
                    () => MatrixClientPeg.get().getGroupUsers(groupId).then(parseMembersResponse),
                );
            },
            [this.STATE_KEY.GroupInvitedMembers]: (groupId) => {
                return limitConcurrency(
                    () => MatrixClientPeg.get().getGroupInvitedUsers(groupId).then(parseMembersResponse),
                );
            },
        };
    }

    _fetchResource(stateKey, groupId) {
        // Ongoing request, ignore
        if (this._fetchResourcePromise[stateKey][groupId]) return;

        const clientPromise = this._resourceFetcher[stateKey](groupId);

        // Indicate ongoing request
        this._fetchResourcePromise[stateKey][groupId] = clientPromise;

        clientPromise.then((result) => {
            this._state[stateKey][groupId] = result;
            this._ready[stateKey][groupId] = true;
            this._notifyListeners();
        }).catch((err) => {
            // Invited users not visible to non-members
            if (stateKey === this.STATE_KEY.GroupInvitedMembers && err.httpStatus === 403) {
                return;
            }

            console.error(`Failed to get resource ${stateKey} for ${groupId}`, err);
            this.emit('error', err, groupId, stateKey);
        }).finally(() => {
            // Indicate finished request, allow for future fetches
            delete this._fetchResourcePromise[stateKey][groupId];
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
     * If a group ID is specified, this also causes a fetch of all data
     * of the specified group, which might cause 4 separate HTTP
     * requests, but only if said requests aren't already ongoing.
     *
     * @param {string?} groupId the ID of the group to fetch data for.
     *                          Optional.
     * @param {function} fn the function to call when the store updates.
     * @return {Object} tok a registration "token" with a single
     *                      property `unregister`, a function that can
     *                      be called to unregister the listener such
     *                      that it won't be called any more.
     */
    registerListener(groupId, fn) {
        this.on('update', fn);
        // Call to set initial state (before fetching starts)
        this.emit('update');

        if (groupId) {
            this._fetchResource(this.STATE_KEY.Summary, groupId);
            this._fetchResource(this.STATE_KEY.GroupRooms, groupId);
            this._fetchResource(this.STATE_KEY.GroupMembers, groupId);
            this._fetchResource(this.STATE_KEY.GroupInvitedMembers, groupId);
        }

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

    isStateReady(groupId, id) {
        return this._ready[id][groupId];
    }

    getGroupIdsForRoomId(roomId) {
        const groupIds = Object.keys(this._state[this.STATE_KEY.GroupRooms]);
        return groupIds.filter(groupId => {
            const rooms = this._state[this.STATE_KEY.GroupRooms][groupId] || [];
            return rooms.some(room => room.roomId === roomId);
        });
    }

    getSummary(groupId) {
        return this._state[this.STATE_KEY.Summary][groupId] || {};
    }

    getGroupRooms(groupId) {
        return this._state[this.STATE_KEY.GroupRooms][groupId] || [];
    }

    getGroupMembers(groupId) {
        return this._state[this.STATE_KEY.GroupMembers][groupId] || [];
    }

    getGroupInvitedMembers(groupId) {
        return this._state[this.STATE_KEY.GroupInvitedMembers][groupId] || [];
    }

    getGroupPublicity(groupId) {
        return (this._state[this.STATE_KEY.Summary][groupId] || {}).user ?
            (this._state[this.STATE_KEY.Summary][groupId] || {}).user.is_publicised : null;
    }

    isUserPrivileged(groupId) {
        return (this._state[this.STATE_KEY.Summary][groupId] || {}).user ?
            (this._state[this.STATE_KEY.Summary][groupId] || {}).user.is_privileged : null;
    }

    refreshGroupRooms(groupId) {
        return this._fetchResource(this.STATE_KEY.GroupRooms, groupId);
    }

    refreshGroupMembers(groupId) {
        return this._fetchResource(this.STATE_KEY.GroupMembers, groupId);
    }

    addRoomToGroup(groupId, roomId, isPublic) {
        return MatrixClientPeg.get()
            .addRoomToGroup(groupId, roomId, isPublic)
            .then(this._fetchResource.bind(this, this.STATE_KEY.GroupRooms, groupId));
    }

    updateGroupRoomVisibility(groupId, roomId, isPublic) {
        return MatrixClientPeg.get()
            .updateGroupRoomVisibility(groupId, roomId, isPublic)
            .then(this._fetchResource.bind(this, this.STATE_KEY.GroupRooms, groupId));
    }

    removeRoomFromGroup(groupId, roomId) {
        return MatrixClientPeg.get()
            .removeRoomFromGroup(groupId, roomId)
            // Room might be in the summary, refresh just in case
            .then(this._fetchResource.bind(this, this.STATE_KEY.Summary, groupId))
            .then(this._fetchResource.bind(this, this.STATE_KEY.GroupRooms, groupId));
    }

    inviteUserToGroup(groupId, userId) {
        return MatrixClientPeg.get().inviteUserToGroup(groupId, userId)
            .then(this._fetchResource.bind(this, this.STATE_KEY.GroupInvitedMembers, groupId));
    }

    acceptGroupInvite(groupId) {
        return MatrixClientPeg.get().acceptGroupInvite(groupId)
            // The user should now be able to access (personal) group settings
            .then(this._fetchResource.bind(this, this.STATE_KEY.Summary, groupId))
            // The user might be able to see more rooms now
            .then(this._fetchResource.bind(this, this.STATE_KEY.GroupRooms, groupId))
            // The user should now appear as a member
            .then(this._fetchResource.bind(this, this.STATE_KEY.GroupMembers, groupId))
            // The user should now not appear as an invited member
            .then(this._fetchResource.bind(this, this.STATE_KEY.GroupInvitedMembers, groupId));
    }

    joinGroup(groupId) {
        return MatrixClientPeg.get().joinGroup(groupId)
            // The user should now be able to access (personal) group settings
            .then(this._fetchResource.bind(this, this.STATE_KEY.Summary, groupId))
            // The user might be able to see more rooms now
            .then(this._fetchResource.bind(this, this.STATE_KEY.GroupRooms, groupId))
            // The user should now appear as a member
            .then(this._fetchResource.bind(this, this.STATE_KEY.GroupMembers, groupId))
            // The user should now not appear as an invited member
            .then(this._fetchResource.bind(this, this.STATE_KEY.GroupInvitedMembers, groupId));
    }

    leaveGroup(groupId) {
        // ensure the tag panel filter is cleared if the group was selected
        dis.dispatch({
            action: "deselect_tags",
            tag: groupId,
        });
        return MatrixClientPeg.get().leaveGroup(groupId)
            // The user should now not be able to access group settings
            .then(this._fetchResource.bind(this, this.STATE_KEY.Summary, groupId))
            // The user might only be able to see a subset of rooms now
            .then(this._fetchResource.bind(this, this.STATE_KEY.GroupRooms, groupId))
            // The user should now not appear as a member
            .then(this._fetchResource.bind(this, this.STATE_KEY.GroupMembers, groupId));
    }

    addRoomToGroupSummary(groupId, roomId, categoryId) {
        return MatrixClientPeg.get()
            .addRoomToGroupSummary(groupId, roomId, categoryId)
            .then(this._fetchResource.bind(this, this.STATE_KEY.Summary, groupId));
    }

    addUserToGroupSummary(groupId, userId, roleId) {
        return MatrixClientPeg.get()
            .addUserToGroupSummary(groupId, userId, roleId)
            .then(this._fetchResource.bind(this, this.STATE_KEY.Summary, groupId));
    }

    removeRoomFromGroupSummary(groupId, roomId) {
        return MatrixClientPeg.get()
            .removeRoomFromGroupSummary(groupId, roomId)
            .then(this._fetchResource.bind(this, this.STATE_KEY.Summary, groupId));
    }

    removeUserFromGroupSummary(groupId, userId) {
        return MatrixClientPeg.get()
            .removeUserFromGroupSummary(groupId, userId)
            .then(this._fetchResource.bind(this, this.STATE_KEY.Summary, groupId));
    }

    setGroupPublicity(groupId, isPublished) {
        return MatrixClientPeg.get()
            .setGroupPublicity(groupId, isPublished)
            .then(() => { FlairStore.invalidatePublicisedGroups(MatrixClientPeg.get().credentials.userId); })
            .then(this._fetchResource.bind(this, this.STATE_KEY.Summary, groupId));
    }
}

let singletonGroupStore = null;
if (!singletonGroupStore) {
    singletonGroupStore = new GroupStore();
}
export default singletonGroupStore;

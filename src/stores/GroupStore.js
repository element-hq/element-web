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

/**
 * Stores the group summary for a room and provides an API to change it and
 * other useful group APIs that may have an effect on the group summary.
 */
export default class GroupStore extends EventEmitter {
    constructor(matrixClient, groupId) {
        super();
        this.groupId = groupId;
        this._matrixClient = matrixClient;
        this._summary = {};
        this._rooms = [];

        this.on('error', (err) => {
            console.error(`GroupStore for ${this.groupId} encountered error`, err);
        });
    }

    _fetchMembers() {
        this._matrixClient.getGroupUsers(this.groupId).then((result) => {
            this._members = result.chunk.map((apiMember) => {
                return groupMemberFromApiObject(apiMember);
            });
            this._notifyListeners();
        }).catch((err) => {
            console.error("Failed to get group member list: " + err);
            this.emit('error', err);
        });

        this._matrixClient.getGroupInvitedUsers(this.groupId).then((result) => {
            this._invitedMembers = result.chunk.map((apiMember) => {
                return groupMemberFromApiObject(apiMember);
            });
            this._notifyListeners();
        }).catch((err) => {
            console.error("Failed to get group invited member list: " + err);
            this.emit('error', err);
        });
    }

    _fetchSummary() {
        this._matrixClient.getGroupSummary(this.groupId).then((resp) => {
            this._summary = resp;
            this._notifyListeners();
        }).catch((err) => {
            this.emit('error', err);
        });
    }

    _fetchRooms() {
        this._matrixClient.getGroupRooms(this.groupId).then((resp) => {
            this._rooms = resp.chunk.map((apiRoom) => {
                return groupRoomFromApiObject(apiRoom);
            });
            this._notifyListeners();
        }).catch((err) => {
            this.emit('error', err);
        });
    }

    _notifyListeners() {
        this.emit('update');
    }

    registerListener(fn) {
        this.on('update', fn);
        this._fetchSummary();
        this._fetchRooms();
        this._fetchMembers();
    }

    getSummary() {
        return this._summary;
    }

    getGroupRooms() {
        return this._rooms;
    }

    getGroupMembers( ) {
        return this._members;
    }

    getGroupInvitedMembers( ) {
        return this._invitedMembers;
    }

    getGroupPublicity() {
        return this._summary.user ? this._summary.user.is_publicised : null;
    }

    isUserPrivileged() {
        return this._summary.user ? this._summary.user.is_privileged : null;
    }

    addRoomToGroup(roomId) {
        return this._matrixClient
            .addRoomToGroup(this.groupId, roomId)
            .then(this._fetchRooms.bind(this));
    }

    removeRoomFromGroup(roomId) {
        return this._matrixClient
            .removeRoomFromGroup(this.groupId, roomId)
            // Room might be in the summary, refresh just in case
            .then(this._fetchSummary.bind(this))
            .then(this._fetchRooms.bind(this));
    }

    inviteUserToGroup(userId) {
        return this._matrixClient.inviteUserToGroup(this.groupId, userId)
            .then(this._fetchMembers.bind(this));
    }

    addRoomToGroupSummary(roomId, categoryId) {
        return this._matrixClient
            .addRoomToGroupSummary(this.groupId, roomId, categoryId)
            .then(this._fetchSummary.bind(this));
    }

    addUserToGroupSummary(userId, roleId) {
        return this._matrixClient
            .addUserToGroupSummary(this.groupId, userId, roleId)
            .then(this._fetchSummary.bind(this));
    }

    removeRoomFromGroupSummary(roomId) {
        return this._matrixClient
            .removeRoomFromGroupSummary(this.groupId, roomId)
            .then(this._fetchSummary.bind(this));
    }

    removeUserFromGroupSummary(userId) {
        return this._matrixClient
            .removeUserFromGroupSummary(this.groupId, userId)
            .then(this._fetchSummary.bind(this));
    }

    setGroupPublicity(isPublished) {
        return this._matrixClient
            .setGroupPublicity(this.groupId, isPublished)
            .then(() => { FlairStore.invalidatePublicisedGroups(this._matrixClient.credentials.userId); })
            .then(this._fetchSummary.bind(this));
    }
}

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

/**
 * Stores the group summary for a room and provides an API to change it
 */
export default class GroupSummaryStore extends EventEmitter {
    constructor(matrixClient, groupId) {
        super();
        this._groupId = groupId;
        this._matrixClient = matrixClient;
        this._summary = {};
        this._fetchSummary();
    }

    _fetchSummary() {
        this._matrixClient.getGroupSummary(this._groupId).then((resp) => {
            this._summary = resp;
            this._notifyListeners();
        }).catch((err) => {
            this.emit('error', err);
        });
    }

    _notifyListeners() {
        this.emit('update');
    }

    getSummary() {
        return this._summary;
    }

    addRoomToGroupSummary(roomId, categoryId) {
        return this._matrixClient
            .addRoomToGroupSummary(this._groupId, roomId, categoryId)
            .then(this._fetchSummary.bind(this));
    }

    addUserToGroupSummary(userId, roleId) {
        return this._matrixClient
            .addUserToGroupSummary(this._groupId, userId, roleId)
            .then(this._fetchSummary.bind(this));
    }

    removeRoomFromGroupSummary(roomId) {
        return this._matrixClient
            .removeRoomFromGroupSummary(this._groupId, roomId)
            .then(this._fetchSummary.bind(this));
    }

    removeUserFromGroupSummary(userId) {
        return this._matrixClient
            .removeUserFromGroupSummary(this._groupId, userId)
            .then(this._fetchSummary.bind(this));
    }
}

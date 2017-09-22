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
import MatrixClientPeg from '../MatrixClientPeg';

/**
 * Stores the group summary for a room and provides an API to change it
 */
export default class GroupSummaryStore extends EventEmitter {
    constructor(groupId) {
        super();
        this._groupId = groupId;
        this._summary = {};
        this._fetchSummary();
    }

    _fetchSummary() {
        MatrixClientPeg.get().getGroupSummary(this._groupId).then((resp) => {
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
        return MatrixClientPeg.get()
            .addRoomToGroupSummary(this._groupId, roomId, categoryId)
            .then(this._fetchSummary.bind(this));
    }

    addUserToGroupSummary(userId, roleId) {
        return MatrixClientPeg.get()
            .addUserToGroupSummary(this._groupId, userId, roleId)
            .then(this._fetchSummary.bind(this));
    }

    removeRoomFromGroupSummary(roomId) {
        return MatrixClientPeg.get()
            .removeRoomFromGroupSummary(this._groupId, roomId)
            .then(this._fetchSummary.bind(this));
    }

    removeUserFromGroupSummary(userId) {
        return MatrixClientPeg.get()
            .removeUserFromGroupSummary(this._groupId, userId)
            .then(this._fetchSummary.bind(this));
    }
}

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

import RoomViewStore from './stores/RoomViewStore';

/**
 * Consumes changes from the RoomViewStore and notifies specific things
 * about when the active room changes. Unlike listening for RoomViewStore
 * changes, you can subscribe to only changes relevant to a particular
 * room.
 *
 * TODO: If we introduce an observer for something else, factor out
 * the adding / removing of listeners & emitting into a common class.
 */
class ActiveRoomObserver {
    constructor() {
        this._listeners = {}; // key=roomId, value=function(isActive:boolean)

        this._activeRoomId = RoomViewStore.getRoomId();
        // TODO: We could self-destruct when the last listener goes away, or at least
        // stop listening.
        this._roomStoreToken = RoomViewStore.addListener(this._onRoomViewStoreUpdate.bind(this));
    }

    get activeRoomId(): string {
        return this._activeRoomId;
    }

    addListener(roomId, listener) {
        if (!this._listeners[roomId]) this._listeners[roomId] = [];
        this._listeners[roomId].push(listener);
    }

    removeListener(roomId, listener) {
        if (this._listeners[roomId]) {
            const i = this._listeners[roomId].indexOf(listener);
            if (i > -1) {
                this._listeners[roomId].splice(i, 1);
            }
        } else {
            console.warn("Unregistering unrecognised listener (roomId=" + roomId + ")");
        }
    }

    _emit(roomId, isActive: boolean) {
        if (!this._listeners[roomId]) return;

        for (const l of this._listeners[roomId]) {
            l.call(null, isActive);
        }
    }

    _onRoomViewStoreUpdate() {
        // emit for the old room ID
        if (this._activeRoomId) this._emit(this._activeRoomId, false);

        // update our cache
        this._activeRoomId = RoomViewStore.getRoomId();

        // and emit for the new one
        if (this._activeRoomId) this._emit(this._activeRoomId, true);
    }
}

if (global.mx_ActiveRoomObserver === undefined) {
    global.mx_ActiveRoomObserver = new ActiveRoomObserver();
}
export default global.mx_ActiveRoomObserver;

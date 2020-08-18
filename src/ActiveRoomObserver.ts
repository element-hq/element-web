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

type Listener = (isActive: boolean) => void;

/**
 * Consumes changes from the RoomViewStore and notifies specific things
 * about when the active room changes. Unlike listening for RoomViewStore
 * changes, you can subscribe to only changes relevant to a particular
 * room.
 *
 * TODO: If we introduce an observer for something else, factor out
 * the adding / removing of listeners & emitting into a common class.
 */
export class ActiveRoomObserver {
    private listeners: {[key: string]: Listener[]} = {};
    private _activeRoomId = RoomViewStore.getRoomId();
    private readonly roomStoreToken: string;

    constructor() {
        // TODO: We could self-destruct when the last listener goes away, or at least stop listening.
        this.roomStoreToken = RoomViewStore.addListener(this.onRoomViewStoreUpdate);
    }

    public get activeRoomId(): string {
        return this._activeRoomId;
    }

    public addListener(roomId, listener) {
        if (!this.listeners[roomId]) this.listeners[roomId] = [];
        this.listeners[roomId].push(listener);
    }

    public removeListener(roomId, listener) {
        if (this.listeners[roomId]) {
            const i = this.listeners[roomId].indexOf(listener);
            if (i > -1) {
                this.listeners[roomId].splice(i, 1);
            }
        } else {
            console.warn("Unregistering unrecognised listener (roomId=" + roomId + ")");
        }
    }

    private emit(roomId, isActive: boolean) {
        if (!this.listeners[roomId]) return;

        for (const l of this.listeners[roomId]) {
            l.call(null, isActive);
        }
    }

    private onRoomViewStoreUpdate = () => {
        // emit for the old room ID
        if (this._activeRoomId) this.emit(this._activeRoomId, false);

        // update our cache
        this._activeRoomId = RoomViewStore.getRoomId();

        // and emit for the new one
        if (this._activeRoomId) this.emit(this._activeRoomId, true);
    };
}

if (window.mxActiveRoomObserver === undefined) {
    window.mxActiveRoomObserver = new ActiveRoomObserver();
}
export default window.mxActiveRoomObserver;

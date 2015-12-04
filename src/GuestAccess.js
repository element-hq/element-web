/*
Copyright 2015 OpenMarket Ltd

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
import {MatrixClientPeg} from "./MatrixClientPeg";
const ROOM_ID_KEY = "matrix-guest-room-ids";
const IS_GUEST_KEY = "matrix-is-guest";

class GuestAccess {

    constructor(localStorage) {
        var existingRoomIds;
        try {
            this._isGuest = localStorage.getItem(IS_GUEST_KEY) === "true";
            existingRoomIds = JSON.parse(
                localStorage.getItem(ROOM_ID_KEY) // an array
            );
        }
        catch (e) {} // don't care
        this.rooms = new Set(existingRoomIds);
        this.localStorage = localStorage;
    }

    addRoom(roomId) {
        this.rooms.add(roomId);
        this._saveAndSetRooms();
    }

    removeRoom(roomId) {
        this.rooms.delete(roomId);
        this._saveAndSetRooms();
    }

    getRooms() {
        return Array.from(this.rooms.entries());
    }

    isGuest() {
        return this._isGuest;
    }

    markAsGuest(isGuest) {
        try {
            this.localStorage.setItem(IS_GUEST_KEY, JSON.stringify(isGuest));
            // nuke the rooms being watched from previous guest accesses if any.
            this.localStorage.setItem(ROOM_ID_KEY, "[]");
        } catch (e) {} // ignore. If they don't do LS, they'll just get a new account.
        this._isGuest = isGuest;
        this.rooms = new Set();
    }

    _saveAndSetRooms() {
        let rooms = this.getRooms();
        MatrixClientPeg.get().setGuestRooms(rooms);
        try {
            this.localStorage.setItem(ROOM_ID_KEY, rooms);
        } catch (e) {}
    }
}

module.exports = GuestAccess;

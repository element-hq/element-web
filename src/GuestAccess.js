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

class GuestAccess {

    constructor(localStorage) {
        var existingRoomIds;
        try {
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
    }

    removeRoom(roomId) {
        this.rooms.delete(roomId);
    }

    getRooms() {
        return this.rooms.entries();
    }

    register() {
        // nuke the rooms being watched from previous guest accesses if any.
        localStorage.setItem(ROOM_ID_KEY, "[]");
        return MatrixClientPeg.get().registerGuest();
    }
}

module.exports = GuestAccess;

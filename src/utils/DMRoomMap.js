/*
Copyright 2016 OpenMarket Ltd

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

/**
 * Class that takes a Matrix Client and flips the m.direct map
 * so the operation of mapping a room ID to which user it's a DM
 * with can be performed efficiently.
 */
export default class DMRoomMap {
    constructor(matrixClient) {
        const mDirectEvent = matrixClient.getAccountData('m.direct');
        if (!mDirectEvent) {
            this.userToRooms = {};
            this.roomToUser = {};
        } else {
            this.userToRooms = mDirectEvent.getContent();
            this.roomToUser = {};
            for (const user of Object.keys(this.userToRooms)) {
                for (const roomId of this.userToRooms[user]) {
                    this.roomToUser[roomId] = user;
                }
            }
        }
    }

    getDMRoomsForUserId(userId) {
        return this.userToRooms[userId];
    }

    getUserIdForRoomId(roomId) {
        return this.roomToUser[roomId];
    }
}

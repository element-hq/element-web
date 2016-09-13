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
        this.matrixClient = matrixClient;
        this.roomToUser = null;

        const mDirectEvent = matrixClient.getAccountData('m.direct');
        if (!mDirectEvent) {
            this.userToRooms = {};
        } else {
            this.userToRooms = mDirectEvent.getContent();
        }
    }

    getDMRoomsForUserId(userId) {
        // Here, we return the empty list if there are no rooms,
        // since the number of conversations you have with this user is zero.
        return this.userToRooms[userId] || [];
    }

    getUserIdForRoomId(roomId) {
        if (this.roomToUser == null) {
            // we lazily populate roomToUser so you can use
            // this class just to call getDMRoomsForUserId
            // which doesn't do very much, but is a fairly
            // convenient wrapper and there's no point
            // iterating through the map if getUserIdForRoomId()
            // is never called.
            this._populateRoomToUser();
        }
        // Here, we return undefined if the room is not in the map:
        // the room ID you gave is not a DM room for any user.
        if (this.roomToUser[roomId] === undefined) {
            // no entry? if the room is an invite, look for the is_direct hint.
            const room = this.matrixClient.getRoom(roomId);
            if (room) {
                const me = room.getMember(this.matrixClient.credentials.userId);
                if (me.membership == 'invite') {
                    // The 'direct' hihnt is there, so declare that this is a DM room for
                    // whoever invited us.
                    if (me.events.member.getContent().is_direct) {
                        return me.events.member.getSender();
                    }
                }
            }
        }
        return this.roomToUser[roomId];
    }

    _populateRoomToUser() {
        this.roomToUser = {};
        for (const user of Object.keys(this.userToRooms)) {
            for (const roomId of this.userToRooms[user]) {
                this.roomToUser[roomId] = user;
            }
        }
    }
}

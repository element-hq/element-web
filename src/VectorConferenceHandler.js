/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import {createNewMatrixCall as jsCreateNewMatrixCall, Room} from "matrix-js-sdk";
import CallHandler from './CallHandler';
import {MatrixClientPeg} from "./MatrixClientPeg";

// FIXME: this is Riot (Vector) specific code, but will be removed shortly when
// we switch over to jitsi entirely for video conferencing.

// FIXME: This currently forces Vector to try to hit the matrix.org AS for conferencing.
// This is bad because it prevents people running their own ASes from being used.
// This isn't permanent and will be customisable in the future: see the proposal
// at docs/conferencing.md for more info.
const USER_PREFIX = "fs_";
const DOMAIN = "matrix.org";

export function ConferenceCall(matrixClient, groupChatRoomId) {
    this.client = matrixClient;
    this.groupRoomId = groupChatRoomId;
    this.confUserId = getConferenceUserIdForRoom(this.groupRoomId);
}

ConferenceCall.prototype.setup = function() {
    const self = this;
    return this._joinConferenceUser().then(function() {
        return self._getConferenceUserRoom();
    }).then(function(room) {
        // return a call for *this* room to be placed. We also tack on
        // confUserId to speed up lookups (else we'd need to loop every room
        // looking for a 1:1 room with this conf user ID!)
        const call = jsCreateNewMatrixCall(self.client, room.roomId);
        call.confUserId = self.confUserId;
        call.groupRoomId = self.groupRoomId;
        return call;
    });
};

ConferenceCall.prototype._joinConferenceUser = function() {
    // Make sure the conference user is in the group chat room
    const groupRoom = this.client.getRoom(this.groupRoomId);
    if (!groupRoom) {
        return Promise.reject("Bad group room ID");
    }
    const member = groupRoom.getMember(this.confUserId);
    if (member && member.membership === "join") {
        return Promise.resolve();
    }
    return this.client.invite(this.groupRoomId, this.confUserId);
};

ConferenceCall.prototype._getConferenceUserRoom = function() {
    // Use an existing 1:1 with the conference user; else make one
    const rooms = this.client.getRooms();
    let confRoom = null;
    for (let i = 0; i < rooms.length; i++) {
        const confUser = rooms[i].getMember(this.confUserId);
        if (confUser && confUser.membership === "join" &&
                rooms[i].getJoinedMemberCount() === 2) {
            confRoom = rooms[i];
            break;
        }
    }
    if (confRoom) {
        return Promise.resolve(confRoom);
    }
    return this.client.createRoom({
        preset: "private_chat",
        invite: [this.confUserId],
    }).then(function(res) {
        return new Room(res.room_id, null, MatrixClientPeg.get().getUserId());
    });
};

/**
 * Check if this user ID is in fact a conference bot.
 * @param {string} userId The user ID to check.
 * @return {boolean} True if it is a conference bot.
 */
export function isConferenceUser(userId) {
    if (userId.indexOf("@" + USER_PREFIX) !== 0) {
        return false;
    }
    const base64part = userId.split(":")[0].substring(1 + USER_PREFIX.length);
    if (base64part) {
        const decoded = new Buffer(base64part, "base64").toString();
        // ! $STUFF : $STUFF
        return /^!.+:.+/.test(decoded);
    }
    return false;
}

export function getConferenceUserIdForRoom(roomId) {
    // abuse browserify's core node Buffer support (strip padding ='s)
    const base64RoomId = new Buffer(roomId).toString("base64").replace(/=/g, "");
    return "@" + USER_PREFIX + base64RoomId + ":" + DOMAIN;
}

export function createNewMatrixCall(client, roomId) {
    const confCall = new ConferenceCall(
        client, roomId,
    );
    return confCall.setup();
}

export function getConferenceCallForRoom(roomId) {
    // search for a conference 1:1 call for this group chat room ID
    const activeCall = CallHandler.getAnyActiveCall();
    if (activeCall && activeCall.confUserId) {
        const thisRoomConfUserId = getConferenceUserIdForRoom(
            roomId,
        );
        if (thisRoomConfUserId === activeCall.confUserId) {
            return activeCall;
        }
    }
    return null;
}

// TODO: Document this.
export const slot = 'conference';

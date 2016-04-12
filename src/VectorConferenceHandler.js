/*
Copyright 2015, 2016 OpenMarket Ltd

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

"use strict";

var q = require("q");
var Matrix = require("matrix-js-sdk");
var Room = Matrix.Room;
var CallHandler = require('matrix-react-sdk/lib/CallHandler');

// FIXME: This currently forces Vector to try to hit the matrix.org AS for conferencing.
// This is bad because it prevents people running their own ASes from being used.
// This isn't permanent and will be customisable in the future: see the proposal
// at docs/conferencing.md for more info.
var USER_PREFIX = "fs_";
var DOMAIN = "matrix.org";

function ConferenceCall(matrixClient, groupChatRoomId) {
    this.client = matrixClient;
    this.groupRoomId = groupChatRoomId;
    this.confUserId = module.exports.getConferenceUserIdForRoom(this.groupRoomId);
}

ConferenceCall.prototype.setup = function() {
    var self = this;
    return this._joinConferenceUser().then(function() {
        return self._getConferenceUserRoom();
    }).then(function(room) {
        // return a call for *this* room to be placed. We also tack on
        // confUserId to speed up lookups (else we'd need to loop every room
        // looking for a 1:1 room with this conf user ID!)
        var call = Matrix.createNewMatrixCall(self.client, room.roomId);
        call.confUserId = self.confUserId;
        call.groupRoomId = self.groupRoomId;
        return call;
    });
};

ConferenceCall.prototype._joinConferenceUser = function() {
    // Make sure the conference user is in the group chat room
    var groupRoom = this.client.getRoom(this.groupRoomId);
    if (!groupRoom) {
        return q.reject("Bad group room ID");
    }
    var member = groupRoom.getMember(this.confUserId);
    if (member && member.membership === "join") {
        return q();
    }
    return this.client.invite(this.groupRoomId, this.confUserId);
};

ConferenceCall.prototype._getConferenceUserRoom = function() {
    // Use an existing 1:1 with the conference user; else make one
    var rooms = this.client.getRooms();
    var confRoom = null;
    for (var i = 0; i < rooms.length; i++) {
        var confUser = rooms[i].getMember(this.confUserId);
        if (confUser && confUser.membership === "join" &&
                rooms[i].getJoinedMembers().length === 2) {
            confRoom = rooms[i];
            break;
        }
    }
    if (confRoom) {
        return q(confRoom);
    }
    return this.client.createRoom({
        preset: "private_chat",
        invite: [this.confUserId]
    }).then(function(res) {
        return new Room(res.room_id);
    });
};

/**
 * Check if this user ID is in fact a conference bot.
 * @param {string} userId The user ID to check.
 * @return {boolean} True if it is a conference bot.
 */
module.exports.isConferenceUser = function(userId) {
    if (userId.indexOf("@" + USER_PREFIX) !== 0) {
        return false;
    }
    var base64part = userId.split(":")[0].substring(1 + USER_PREFIX.length);
    if (base64part) {
        var decoded = new Buffer(base64part, "base64").toString();
        // ! $STUFF : $STUFF
        return /^!.+:.+/.test(decoded);
    }
    return false;
};

module.exports.getConferenceUserIdForRoom = function(roomId) {
    // abuse browserify's core node Buffer support (strip padding ='s)
    var base64RoomId = new Buffer(roomId).toString("base64").replace(/=/g, "");
    return "@" + USER_PREFIX + base64RoomId + ":" + DOMAIN;
};

module.exports.createNewMatrixCall = function(client, roomId) {
    var confCall = new ConferenceCall(
        client, roomId
    );
    return confCall.setup();
};

module.exports.getConferenceCallForRoom = function(roomId) {
    // search for a conference 1:1 call for this group chat room ID
    var activeCall = CallHandler.getAnyActiveCall();
    if (activeCall && activeCall.confUserId) {
        var thisRoomConfUserId = module.exports.getConferenceUserIdForRoom(
            roomId
        );
        if (thisRoomConfUserId === activeCall.confUserId) {
            return activeCall;
        }
    }
    return null;
};

module.exports.ConferenceCall = ConferenceCall;

module.exports.slot = 'conference';

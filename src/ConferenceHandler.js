"use strict";
var q = require("q");
var Matrix = require("matrix-js-sdk");
var Room = Matrix.Room;

var USER_PREFIX = "fs_";
var DOMAIN = "matrix.org";

function ConferenceHandler(matrixClient, groupChatRoomId) {
    this.client = matrixClient;
    this.groupRoomId = groupChatRoomId;
    // abuse browserify's core node Buffer support (strip padding ='s)
    this.base64RoomId = new Buffer(this.groupRoomId).toString("base64").replace(/=/g, "");
    this.confUserId = "@" + USER_PREFIX + this.base64RoomId + ":" + DOMAIN;
}

ConferenceHandler.prototype.setup = function() {
    var self = this;
    return this._joinConferenceUser().then(function() {
        return self._getConferenceUserRoom();
    }).then(function(room) {
        // return a call for *this* room to be placed.
        return Matrix.createNewMatrixCall(self.client, room.roomId);
    });
};

ConferenceHandler.prototype._joinConferenceUser = function() {
    // Make sure the conference user is in the group chat room
    var groupRoom = this.client.getRoom(this.groupRoomId);
    if (!groupRoom) {
        return q.reject("Bad group room ID");
    }
    var members = groupRoom.getJoinedMembers();
    var confUserExists = false;
    for (var i = 0; i < members.length; i++) {
        if (members[i].userId === this.confUserId) {
            confUserExists = true;
            break;
        }
    }
    if (confUserExists) {
        return q();
    }
    return this.client.invite(this.groupRoomId, this.confUserId);
};

ConferenceHandler.prototype._getConferenceUserRoom = function() {
    // Use an existing 1:1 with the conference user; else make one
    var rooms = this.client.getRooms();
    var confRoom = null;
    for (var i = 0; i < rooms.length; i++) {
        if (rooms[i].hasMembershipState(this.confUserId, "join") &&
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

module.exports = ConferenceHandler;


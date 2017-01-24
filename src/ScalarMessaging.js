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

/*
Listens for incoming postMessage requests from the integrations UI URL. The following API is exposed:
{
    action: "invite" | "membership_state" | "bot_options" | "set_bot_options",
    room_id: $ROOM_ID,
    user_id: $USER_ID
    // additional request fields
}

The complete request object is returned to the caller with an additional "response" key like so:
{
    action: "invite" | "membership_state" | "bot_options" | "set_bot_options",
    room_id: $ROOM_ID,
    user_id: $USER_ID,
    // additional request fields
    response: { ... }
}

The "action" determines the format of the request and response. All actions can return an error response.
An error response is a "response" object which consists of a sole "error" key to indicate an error.
They look like:
{
    error: {
        message: "Unable to invite user into room.",
        _error: <Original Error Object>
    }
}
The "message" key should be a human-friendly string.

ACTIONS
=======
All actions can return an error response instead of the response outlined below.

invite
------
Invites a user into a room.

Request:
 - room_id is the room to invite the user into.
 - user_id is the user ID to invite.
 - No additional fields.
Response:
{
    success: true
}
Example:
{
    action: "invite",
    room_id: "!foo:bar",
    user_id: "@invitee:bar",
    response: {
        success: true
    }
}

set_bot_options
---------------
Set the m.room.bot.options state event for a bot user.

Request:
 - room_id is the room to send the state event into.
 - user_id is the user ID of the bot who you're setting options for.
 - "content" is an object consisting of the content you wish to set.
Response:
{
    success: true
}
Example:
{
    action: "set_bot_options",
    room_id: "!foo:bar",
    user_id: "@bot:bar",
    content: {
        default_option: "alpha"
    },
    response: {
        success: true
    }
}

membership_state AND bot_options
--------------------------------
Get the content of the "m.room.member" or "m.room.bot.options" state event respectively.

NB: Whilst this API is basically equivalent to getStateEvent, we specifically do not
    want external entities to be able to query any state event for any room, hence the
    restrictive API outlined here.

Request:
 - room_id is the room which has the state event.
 - user_id is the state_key parameter which in both cases is a user ID (the member or the bot).
 - No additional fields.
Response:
 - The event content. If there is no state event, the "response" key should be null.
Example:
{
    action: "membership_state",
    room_id: "!foo:bar",
    user_id: "@somemember:bar",
    response: {
        membership: "join",
        displayname: "Bob",
        avatar_url: null
    }
}
*/

const SdkConfig = require('./SdkConfig');
const MatrixClientPeg = require("./MatrixClientPeg");
const MatrixEvent = require("matrix-js-sdk").MatrixEvent;
const dis = require("./dispatcher");

function sendResponse(event, res) {
    const data = JSON.parse(JSON.stringify(event.data));
    data.response = res;
    event.source.postMessage(data, event.origin);
}

function sendError(event, msg, nestedError) {
    console.error("Action:" + event.data.action + " failed with message: " + msg);
    const data = JSON.parse(JSON.stringify(event.data));
    data.response = {
        error: {
            message: msg,
        },
    };
    if (nestedError) {
        data.response.error._error = nestedError;
    }
    event.source.postMessage(data, event.origin);
}

function inviteUser(event, roomId, userId) {
    console.log(`Received request to invite ${userId} into room ${roomId}`);
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, "You need to be logged in.");
        return;
    }
    const room = client.getRoom(roomId);
    if (room) {
        // if they are already invited we can resolve immediately.
        const member = room.getMember(userId);
        if (member && member.membership === "invite") {
            sendResponse(event, {
                success: true,
            });
            return;
        }
    }

    client.invite(roomId, userId).done(function() {
        sendResponse(event, {
            success: true,
        });
    }, function(err) {
        sendError(event, "You need to be able to invite users to do that.", err);
    });
}

function setPlumbingState(event, roomId, status) {
    if (typeof status !== 'string') {
        throw new Error('Plumbing state status should be a string');
    }
    console.log(`Received request to set plumbing state to status "${status}" in room ${roomId}`);
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, "You need to be logged in.");
        return;
    }
    client.sendStateEvent(roomId, "m.room.plumbing", { status : status }).done(() => {
        sendResponse(event, {
            success: true,
        });
    }, (err) => {
        sendError(event, err.message ? err.message : "Failed to send request.", err);
    });
}

function setBotOptions(event, roomId, userId) {
    console.log(`Received request to set options for bot ${userId} in room ${roomId}`);
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, "You need to be logged in.");
        return;
    }
    client.sendStateEvent(roomId, "m.room.bot.options", event.data.content, "_" + userId).done(() => {
        sendResponse(event, {
            success: true,
        });
    }, (err) => {
        sendError(event, err.message ? err.message : "Failed to send request.", err);
    });
}

function setBotPower(event, roomId, userId, level) {
    if (!(Number.isInteger(level) && level >= 0)) {
        sendError(event, "Power level must be positive integer.");
        return;
    }

    console.log(`Received request to set power level to ${level} for bot ${userId} in room ${roomId}.`);
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, "You need to be logged in.");
        return;
    }

    client.getStateEvent(roomId, "m.room.power_levels", "").then((powerLevels) => {
        let powerEvent = new MatrixEvent(
            {
                type: "m.room.power_levels",
                content: powerLevels,
            }
        );

        client.setPowerLevel(roomId, userId, level, powerEvent).done(() => {
            sendResponse(event, {
                success: true,
            });
        }, (err) => {
            sendError(event, err.message ? err.message : "Failed to send request.", err);
        });
    });
}

function getMembershipState(event, roomId, userId) {
    console.log(`membership_state of ${userId} in room ${roomId} requested.`);
    returnStateEvent(event, roomId, "m.room.member", userId);
}

function getJoinRules(event, roomId) {
    console.log(`join_rules of ${roomId} requested.`);
    returnStateEvent(event, roomId, "m.room.join_rules", "");
}

function botOptions(event, roomId, userId) {
    console.log(`bot_options of ${userId} in room ${roomId} requested.`);
    returnStateEvent(event, roomId, "m.room.bot.options", "_" + userId);
}

function returnStateEvent(event, roomId, eventType, stateKey) {
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, "You need to be logged in.");
        return;
    }
    const room = client.getRoom(roomId);
    if (!room) {
        sendError(event, "This room is not recognised.");
        return;
    }
    const stateEvent = room.currentState.getStateEvents(eventType, stateKey);
    if (!stateEvent) {
        sendResponse(event, null);
        return;
    }
    sendResponse(event, stateEvent.getContent());
}

var currentRoomId = null;
var currentRoomAlias = null;

// Listen for when a room is viewed
dis.register(onAction);
function onAction(payload) {
    if (payload.action !== "view_room") {
        return;
    }
    currentRoomId = payload.room_id;
    currentRoomAlias = payload.room_alias;
}

const onMessage = function(event) {
    if (!event.origin) { // stupid chrome
        event.origin = event.originalEvent.origin;
    }

    // Check that the integrations UI URL starts with the origin of the event
    // This means the URL could contain a path (like /develop) and still be used
    // to validate event origins, which do not specify paths.
    // (See https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
    //
    // All strings start with the empty string, so for sanity return if the length
    // of the event origin is 0.
    let url = SdkConfig.get().integrations_ui_url;
    if (event.origin.length === 0 || !url.startsWith(event.origin)) {
        return; // don't log this - debugging APIs like to spam postMessage which floods the log otherwise
    }

    if (event.data.action === "close_scalar") {
        dis.dispatch({ action: "close_scalar" });
        sendResponse(event, null);
        return;
    }

    const roomId = event.data.room_id;
    const userId = event.data.user_id;
    if (!roomId) {
        sendError(event, "Missing room_id in request");
        return;
    }
    let promise = Promise.resolve(currentRoomId);
    if (!currentRoomId) {
        if (!currentRoomAlias) {
            sendError(event, "Must be viewing a room");
            return;
        }
        // no room ID but there is an alias, look it up.
        console.log("Looking up alias " + currentRoomAlias);
        promise = MatrixClientPeg.get().getRoomIdForAlias(currentRoomAlias).then((res) => {
            return res.room_id;
        });
    }

    promise.then((viewingRoomId) => {
        if (roomId !== viewingRoomId) {
            sendError(event, "Room " + roomId + " not visible");
            return;
        }

        // Getting join rules does not require userId
        if (event.data.action === "join_rules_state") {
            getJoinRules(event, roomId);
            return;
        } else if (event.data.action === "set_plumbing_state") {
            setPlumbingState(event, roomId, event.data.status);
            return;
        }

        if (!userId) {
            sendError(event, "Missing user_id in request");
            return;
        }
        switch (event.data.action) {
            case "membership_state":
                getMembershipState(event, roomId, userId);
                break;
            case "invite":
                inviteUser(event, roomId, userId);
                break;
            case "bot_options":
                botOptions(event, roomId, userId);
                break;
            case "set_bot_options":
                setBotOptions(event, roomId, userId);
                break;
            case "set_bot_power":
                setBotPower(event, roomId, userId, event.data.level);
                break;
            default:
                console.warn("Unhandled postMessage event with action '" + event.data.action +"'");
                break;
        }
    }, (err) => {
        console.error(err);
        sendError(event, "Failed to lookup current room.");
    });
};

module.exports = {
    startListening: function() {
        window.addEventListener("message", onMessage, false);
    },

    stopListening: function() {
        window.removeEventListener("message", onMessage);
    },
};

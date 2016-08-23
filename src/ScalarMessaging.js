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
    action: "invite" | "membership_state",
    room_id: $ROOM_ID,
    user_id: $USER_ID
}

The complete request object is returned to the caller with an additional "response" key like so:
{
    action: "invite" | "membership_state",
    room_id: $ROOM_ID,
    user_id: $USER_ID,
    response: { ... }
}

"response" objects can consist of a sole "error" key to indicate an error. These look like:
{
    error: {
        message: "Unable to invite user into room.",
        _error: <Original Error Object>
    }
}
The "message" key should be a human-friendly string.

The response object for "membership_state" looks like:
{
    membership_state: "join" | "leave" | "invite" | "ban"
}

The response object for "invite" looks like:
{
    invite: true
}

*/

const SdkConfig = require('./SdkConfig');
const MatrixClientPeg = require("./MatrixClientPeg");

function sendResponse(event, res) {
    const data = JSON.parse(JSON.stringify(event.data));
    data.response = res;
    event.source.postMessage(data, event.origin);
}

function sendError(event, msg, nestedError) {
    console.error("Action:" + event.data.action + " failed with message: " + msg);
    const data = event.data;
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

function inviteUser(event) {
    const roomId = event.data.room_id;
    const userId = event.data.user_id;
    if (!userId) {
        sendError(event, "Missing user_id in request");
        return;
    }
    if (!roomId) {
        sendError(event, "Missing room_id in request");
        return;
    }
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
                invite: true,
            });
            return;
        }
    }

    client.invite(roomId, userId).then(function() {
        sendResponse(event, {
            invite: true,
        });
    }, function(err) {
        sendError(event, "You need to be able to invite users to do that.", err);
    });
}

function getMembershipState(event) {
    const roomId = event.data.room_id;
    const userId = event.data.user_id;
    if (!userId) {
        sendError(event, "Missing user_id in request");
        return;
    }
    if (!roomId) {
        sendError(event, "Missing room_id in request");
        return;
    }
    console.log(`membership_state of ${userId} in room ${roomId} requested.`);
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
    let membershipState = "leave";
    const member = room.getMember(userId);
    if (member) {
        membershipState = member.membership;
    }
    sendResponse(event, {
        membership_state: membershipState,
    });
}

const onMessage = function(event) {
    if (!event.origin) { // stupid chrome
        event.origin = event.originalEvent.origin;
    }

    // check it is from the integrations UI URL (remove trailing spaces)
    let url = SdkConfig.get().integrations_ui_url;
    if (url.endsWith("/")) {
        url = url.substr(0, url.length - 1);
    }
    if (url !== event.origin) {
        console.warn("Unauthorised postMessage received. Source URL: " + event.origin);
        return;
    }

    switch (event.data.action) {
        case "membership_state":
            getMembershipState(event);
            break;
        case "invite":
            inviteUser(event);
            break;
        default:
            console.warn("Unhandled postMessage event with action '" + event.data.action +"'");
            break;
    }
};

module.exports = {
    startListening: function() {
        window.addEventListener("message", onMessage, false);
    },

    stopListening: function() {
        window.removeEventListener("message", onMessage);
    },
};

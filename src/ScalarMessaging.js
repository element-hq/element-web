/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd

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

// TODO: Generify the name of this and all components within - it's not just for scalar.

/*
Listens for incoming postMessage requests from the integrations UI URL. The following API is exposed:
{
    action: "invite" | "membership_state" | "bot_options" | "set_bot_options" | etc... ,
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

get_membership_count
--------------------
Get the number of joined users in the room.

Request:
 - room_id is the room to get the count in.
Response:
78
Example:
{
    action: "get_membership_count",
    room_id: "!foo:bar",
    response: 78
}

can_send_event
--------------
Check if the client can send the given event into the given room. If the client
is unable to do this, an error response is returned instead of 'response: false'.

Request:
 - room_id is the room to do the check in.
 - event_type is the event type which will be sent.
 - is_state is true if the event to be sent is a state event.
Response:
true
Example:
{
    action: "can_send_event",
    is_state: false,
    event_type: "m.room.message",
    room_id: "!foo:bar",
    response: true
}

set_widget
----------
Set a new widget in the room. Clobbers based on the ID.

Request:
 - `room_id` (String) is the room to set the widget in.
 - `widget_id` (String) is the ID of the widget to add (or replace if it already exists).
   It can be an arbitrary UTF8 string and is purely for distinguishing between widgets.
 - `url` (String) is the URL that clients should load in an iframe to run the widget.
   All widgets must have a valid URL. If the URL is `null` (not `undefined`), the
   widget will be removed from the room.
 - `type` (String) is the type of widget, which is provided as a hint for matrix clients so they
   can configure/lay out the widget in different ways. All widgets must have a type.
 - `name` (String) is an optional human-readable string about the widget.
 - `data` (Object) is some optional data about the widget, and can contain arbitrary key/value pairs.
Response:
{
    success: true
}
Example:
{
    action: "set_widget",
    room_id: "!foo:bar",
    widget_id: "abc123",
    url: "http://widget.url",
    type: "example",
    response: {
        success: true
    }
}

get_widgets
-----------
Get a list of all widgets in the room. The response is an array
of state events.

Request:
 - `room_id` (String) is the room to get the widgets in.
Response:
[
    {
        // TODO: Enable support for m.widget event type (https://github.com/vector-im/riot-web/issues/13111)
        type: "im.vector.modular.widgets",
        state_key: "wid1",
        content: {
            type: "grafana",
            url: "https://grafanaurl",
            name: "dashboard",
            data: {key: "val"}
        }
        room_id: “!foo:bar”,
        sender: "@alice:localhost"
    }
]
Example:
{
    action: "get_widgets",
    room_id: "!foo:bar",
    response: [
        {
            // TODO: Enable support for m.widget event type (https://github.com/vector-im/riot-web/issues/13111)
            type: "im.vector.modular.widgets",
            state_key: "wid1",
            content: {
                type: "grafana",
                url: "https://grafanaurl",
                name: "dashboard",
                data: {key: "val"}
            }
            room_id: “!foo:bar”,
            sender: "@alice:localhost"
        }
    ]
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

import {MatrixClientPeg} from './MatrixClientPeg';
import { MatrixEvent } from 'matrix-js-sdk';
import dis from './dispatcher/dispatcher';
import WidgetUtils from './utils/WidgetUtils';
import RoomViewStore from './stores/RoomViewStore';
import { _t } from './languageHandler';
import {IntegrationManagers} from "./integrations/IntegrationManagers";
import {WidgetType} from "./widgets/WidgetType";

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
        sendError(event, _t('You need to be logged in.'));
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

    client.invite(roomId, userId).then(function() {
        sendResponse(event, {
            success: true,
        });
    }, function(err) {
        sendError(event, _t('You need to be able to invite users to do that.'), err);
    });
}

function setWidget(event, roomId) {
    const widgetId = event.data.widget_id;
    let widgetType = event.data.type;
    const widgetUrl = event.data.url;
    const widgetName = event.data.name; // optional
    const widgetData = event.data.data; // optional
    const userWidget = event.data.userWidget;

    // both adding/removing widgets need these checks
    if (!widgetId || widgetUrl === undefined) {
        sendError(event, _t("Unable to create widget."), new Error("Missing required widget fields."));
        return;
    }

    if (widgetUrl !== null) { // if url is null it is being deleted, don't need to check name/type/etc
        // check types of fields
        if (widgetName !== undefined && typeof widgetName !== 'string') {
            sendError(event, _t("Unable to create widget."), new Error("Optional field 'name' must be a string."));
            return;
        }
        if (widgetData !== undefined && !(widgetData instanceof Object)) {
            sendError(event, _t("Unable to create widget."), new Error("Optional field 'data' must be an Object."));
            return;
        }
        if (typeof widgetType !== 'string') {
            sendError(event, _t("Unable to create widget."), new Error("Field 'type' must be a string."));
            return;
        }
        if (typeof widgetUrl !== 'string') {
            sendError(event, _t("Unable to create widget."), new Error("Field 'url' must be a string or null."));
            return;
        }
    }

    // convert the widget type to a known widget type
    widgetType = WidgetType.fromString(widgetType);

    if (userWidget) {
        WidgetUtils.setUserWidget(widgetId, widgetType, widgetUrl, widgetName, widgetData).then(() => {
            sendResponse(event, {
                success: true,
            });

            dis.dispatch({ action: "user_widget_updated" });
        }).catch((e) => {
            sendError(event, _t('Unable to create widget.'), e);
        });
    } else { // Room widget
        if (!roomId) {
            sendError(event, _t('Missing roomId.'), null);
        }
        WidgetUtils.setRoomWidget(roomId, widgetId, widgetType, widgetUrl, widgetName, widgetData).then(() => {
            sendResponse(event, {
                success: true,
            });
        }, (err) => {
            sendError(event, _t('Failed to send request.'), err);
        });
    }
}

function getWidgets(event, roomId) {
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t('You need to be logged in.'));
        return;
    }
    let widgetStateEvents = [];

    if (roomId) {
        const room = client.getRoom(roomId);
        if (!room) {
            sendError(event, _t('This room is not recognised.'));
            return;
        }
        // XXX: This gets the raw event object (I think because we can't
        // send the MatrixEvent over postMessage?)
        widgetStateEvents = WidgetUtils.getRoomWidgets(room).map((ev) => ev.event);
    }

    // Add user widgets (not linked to a specific room)
    const userWidgets = WidgetUtils.getUserWidgetsArray();
    widgetStateEvents = widgetStateEvents.concat(userWidgets);

    sendResponse(event, widgetStateEvents);
}

function getRoomEncState(event, roomId) {
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t('You need to be logged in.'));
        return;
    }
    const room = client.getRoom(roomId);
    if (!room) {
        sendError(event, _t('This room is not recognised.'));
        return;
    }
    const roomIsEncrypted = MatrixClientPeg.get().isRoomEncrypted(roomId);

    sendResponse(event, roomIsEncrypted);
}

function setPlumbingState(event, roomId, status) {
    if (typeof status !== 'string') {
        throw new Error('Plumbing state status should be a string');
    }
    console.log(`Received request to set plumbing state to status "${status}" in room ${roomId}`);
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t('You need to be logged in.'));
        return;
    }
    client.sendStateEvent(roomId, "m.room.plumbing", { status: status }).then(() => {
        sendResponse(event, {
            success: true,
        });
    }, (err) => {
        sendError(event, err.message ? err.message : _t('Failed to send request.'), err);
    });
}

function setBotOptions(event, roomId, userId) {
    console.log(`Received request to set options for bot ${userId} in room ${roomId}`);
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t('You need to be logged in.'));
        return;
    }
    client.sendStateEvent(roomId, "m.room.bot.options", event.data.content, "_" + userId).then(() => {
        sendResponse(event, {
            success: true,
        });
    }, (err) => {
        sendError(event, err.message ? err.message : _t('Failed to send request.'), err);
    });
}

function setBotPower(event, roomId, userId, level) {
    if (!(Number.isInteger(level) && level >= 0)) {
        sendError(event, _t('Power level must be positive integer.'));
        return;
    }

    console.log(`Received request to set power level to ${level} for bot ${userId} in room ${roomId}.`);
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t('You need to be logged in.'));
        return;
    }

    client.getStateEvent(roomId, "m.room.power_levels", "").then((powerLevels) => {
        const powerEvent = new MatrixEvent(
            {
                type: "m.room.power_levels",
                content: powerLevels,
            },
        );

        client.setPowerLevel(roomId, userId, level, powerEvent).then(() => {
            sendResponse(event, {
                success: true,
            });
        }, (err) => {
            sendError(event, err.message ? err.message : _t('Failed to send request.'), err);
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

function getMembershipCount(event, roomId) {
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t('You need to be logged in.'));
        return;
    }
    const room = client.getRoom(roomId);
    if (!room) {
        sendError(event, _t('This room is not recognised.'));
        return;
    }
    const count = room.getJoinedMemberCount();
    sendResponse(event, count);
}

function canSendEvent(event, roomId) {
    const evType = "" + event.data.event_type; // force stringify
    const isState = Boolean(event.data.is_state);
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t('You need to be logged in.'));
        return;
    }
    const room = client.getRoom(roomId);
    if (!room) {
        sendError(event, _t('This room is not recognised.'));
        return;
    }
    if (room.getMyMembership() !== "join") {
        sendError(event, _t('You are not in this room.'));
        return;
    }
    const me = client.credentials.userId;

    let canSend = false;
    if (isState) {
        canSend = room.currentState.maySendStateEvent(evType, me);
    } else {
        canSend = room.currentState.maySendEvent(evType, me);
    }

    if (!canSend) {
        sendError(event, _t('You do not have permission to do that in this room.'));
        return;
    }

    sendResponse(event, true);
}

function returnStateEvent(event, roomId, eventType, stateKey) {
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t('You need to be logged in.'));
        return;
    }
    const room = client.getRoom(roomId);
    if (!room) {
        sendError(event, _t('This room is not recognised.'));
        return;
    }
    const stateEvent = room.currentState.getStateEvents(eventType, stateKey);
    if (!stateEvent) {
        sendResponse(event, null);
        return;
    }
    sendResponse(event, stateEvent.getContent());
}

const onMessage = function(event) {
    if (!event.origin) { // stupid chrome
        event.origin = event.originalEvent.origin;
    }

    // Check that the integrations UI URL starts with the origin of the event
    // This means the URL could contain a path (like /develop) and still be used
    // to validate event origins, which do not specify paths.
    // (See https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
    let configUrl;
    try {
        if (!openManagerUrl) openManagerUrl = IntegrationManagers.sharedInstance().getPrimaryManager().uiUrl;
        configUrl = new URL(openManagerUrl);
    } catch (e) {
        // No integrations UI URL, ignore silently.
        return;
    }
    let eventOriginUrl;
    try {
        eventOriginUrl = new URL(event.origin);
    } catch (e) {
        return;
    }
    // TODO -- Scalar postMessage API should be namespaced with event.data.api field
    // Fix following "if" statement to respond only to specific API messages.
    if (
        configUrl.origin !== eventOriginUrl.origin ||
        !event.data.action ||
        event.data.api // Ignore messages with specific API set
    ) {
        // don't log this - debugging APIs and browser add-ons like to spam
        // postMessage which floods the log otherwise
        return;
    }

    if (event.data.action === "close_scalar") {
        dis.dispatch({ action: "close_scalar" });
        sendResponse(event, null);
        return;
    }

    const roomId = event.data.room_id;
    const userId = event.data.user_id;

    if (!roomId) {
        // These APIs don't require roomId
        // Get and set user widgets (not associated with a specific room)
        // If roomId is specified, it must be validated, so room-based widgets agreed
        // handled further down.
        if (event.data.action === "get_widgets") {
            getWidgets(event, null);
            return;
        } else if (event.data.action === "set_widget") {
            setWidget(event, null);
            return;
        } else {
            sendError(event, _t('Missing room_id in request'));
            return;
        }
    }

    if (roomId !== RoomViewStore.getRoomId()) {
        sendError(event, _t('Room %(roomId)s not visible', {roomId: roomId}));
        return;
    }

    // Get and set room-based widgets
    if (event.data.action === "get_widgets") {
        getWidgets(event, roomId);
        return;
    } else if (event.data.action === "set_widget") {
        setWidget(event, roomId);
        return;
    }

    // These APIs don't require userId
    if (event.data.action === "join_rules_state") {
        getJoinRules(event, roomId);
        return;
    } else if (event.data.action === "set_plumbing_state") {
        setPlumbingState(event, roomId, event.data.status);
        return;
    } else if (event.data.action === "get_membership_count") {
        getMembershipCount(event, roomId);
        return;
    } else if (event.data.action === "get_room_enc_state") {
        getRoomEncState(event, roomId);
        return;
    } else if (event.data.action === "can_send_event") {
        canSendEvent(event, roomId);
        return;
    }

    if (!userId) {
        sendError(event, _t('Missing user_id in request'));
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
};

let listenerCount = 0;
let openManagerUrl = null;

export function startListening() {
    if (listenerCount === 0) {
        window.addEventListener("message", onMessage, false);
    }
    listenerCount += 1;
}

export function stopListening() {
    listenerCount -= 1;
    if (listenerCount === 0) {
        window.removeEventListener("message", onMessage);
    }
    if (listenerCount < 0) {
        // Make an error so we get a stack trace
        const e = new Error(
            "ScalarMessaging: mismatched startListening / stopListening detected." +
            " Negative count",
        );
        console.error(e);
    }
}

export function setOpenManagerUrl(url) {
    openManagerUrl = url;
}

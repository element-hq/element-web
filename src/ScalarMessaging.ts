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
Invites a user into a room. The request will no-op if the user is already joined OR invited to the room.

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

kick
------
Kicks a user from a room. The request will no-op if the user is not in the room.

Request:
 - room_id is the room to kick the user from.
 - user_id is the user ID to kick.
 - reason is an optional string for the kick reason
Response:
{
    success: true
}
Example:
{
    action: "kick",
    room_id: "!foo:bar",
    user_id: "@target:example.org",
    reason: "Removed from room",
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
 - `avatar_url` (String) is some optional mxc: URI pointing to the avatar of the widget.
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
        // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
        type: "im.vector.modular.widgets",
        state_key: "wid1",
        content: {
            type: "grafana",
            url: "https://grafanaurl",
            name: "dashboard",
            data: {key: "val"}
        }
        room_id: "!foo:bar",
        sender: "@alice:localhost"
    }
]
Example:
{
    action: "get_widgets",
    room_id: "!foo:bar",
    response: [
        {
            // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
            type: "im.vector.modular.widgets",
            state_key: "wid1",
            content: {
                type: "grafana",
                url: "https://grafanaurl",
                name: "dashboard",
                data: {key: "val"}
            }
            room_id: "!foo:bar",
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

get_open_id_token
-----------------
Get an openID token for the current user session.
Request: No parameters
Response:
 - The openId token object as described in https://spec.matrix.org/v1.2/client-server-api/#post_matrixclientv3useruseridopenidrequest_token

send_event
----------
Sends an event in a room.

Request:
 - type is the event type to send.
 - state_key is the state key to send. Omitted if not a state event.
 - content is the event content to send.

Response:
 - room_id is the room ID where the event was sent.
 - event_id is the event ID of the event which was sent.

read_events
-----------
Read events from a room.

Request:
 - type is the event type to read.
 - state_key is the state key to read, or `true` to read all events of the type. Omitted if not a state event.

Response:
 - events: Array of events. If none found, this will be an empty array.

*/

import { IContent, MatrixEvent } from "matrix-js-sdk/src/models/event";
import { logger } from "matrix-js-sdk/src/logger";
import { IEvent } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "./MatrixClientPeg";
import dis from "./dispatcher/dispatcher";
import WidgetUtils from "./utils/WidgetUtils";
import { _t } from "./languageHandler";
import { IntegrationManagers } from "./integrations/IntegrationManagers";
import { WidgetType } from "./widgets/WidgetType";
import { objectClone } from "./utils/objects";
import { EffectiveMembership, getEffectiveMembership } from "./utils/membership";
import { SdkContextClass } from "./contexts/SDKContext";

enum Action {
    CloseScalar = "close_scalar",
    GetWidgets = "get_widgets",
    SetWidget = "set_widget",
    JoinRulesState = "join_rules_state",
    SetPlumbingState = "set_plumbing_state",
    GetMembershipCount = "get_membership_count",
    GetRoomEncryptionState = "get_room_enc_state",
    CanSendEvent = "can_send_event",
    MembershipState = "membership_state",
    invite = "invite",
    Kick = "kick",
    BotOptions = "bot_options",
    SetBotOptions = "set_bot_options",
    SetBotPower = "set_bot_power",
    GetOpenIdToken = "get_open_id_token",
    SendEvent = "send_event",
    ReadEvents = "read_events",
}

function sendResponse(event: MessageEvent<any>, res: any): void {
    const data = objectClone(event.data);
    data.response = res;
    // @ts-ignore
    event.source.postMessage(data, event.origin);
}

function sendError(event: MessageEvent<any>, msg: string, nestedError?: Error): void {
    logger.error("Action:" + event.data.action + " failed with message: " + msg);
    const data = objectClone(event.data);
    data.response = {
        error: {
            message: msg,
        },
    };
    if (nestedError) {
        data.response.error._error = nestedError;
    }
    // @ts-ignore
    event.source.postMessage(data, event.origin);
}

function inviteUser(event: MessageEvent<any>, roomId: string, userId: string): void {
    logger.log(`Received request to invite ${userId} into room ${roomId}`);
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t("You need to be logged in."));
        return;
    }
    const room = client.getRoom(roomId);
    if (room) {
        // if they are already invited or joined we can resolve immediately.
        const member = room.getMember(userId);
        if (member && ["join", "invite"].includes(member.membership!)) {
            sendResponse(event, {
                success: true,
            });
            return;
        }
    }

    client.invite(roomId, userId).then(
        function () {
            sendResponse(event, {
                success: true,
            });
        },
        function (err) {
            sendError(event, _t("You need to be able to invite users to do that."), err);
        },
    );
}

function kickUser(event: MessageEvent<any>, roomId: string, userId: string): void {
    logger.log(`Received request to kick ${userId} from room ${roomId}`);
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t("You need to be logged in."));
        return;
    }
    const room = client.getRoom(roomId);
    if (room) {
        // if they are already not in the room we can resolve immediately.
        const member = room.getMember(userId);
        if (!member || getEffectiveMembership(member.membership!) === EffectiveMembership.Leave) {
            sendResponse(event, {
                success: true,
            });
            return;
        }
    }

    const reason = event.data.reason;
    client
        .kick(roomId, userId, reason)
        .then(() => {
            sendResponse(event, {
                success: true,
            });
        })
        .catch((err) => {
            sendError(event, _t("You need to be able to kick users to do that."), err);
        });
}

function setWidget(event: MessageEvent<any>, roomId: string | null): void {
    const client = MatrixClientPeg.get();
    const widgetId = event.data.widget_id;
    let widgetType = event.data.type;
    const widgetUrl = event.data.url;
    const widgetName = event.data.name; // optional
    const widgetData = event.data.data; // optional
    const widgetAvatarUrl = event.data.avatar_url; // optional
    const userWidget = event.data.userWidget;

    // both adding/removing widgets need these checks
    if (!widgetId || widgetUrl === undefined) {
        sendError(event, _t("Unable to create widget."), new Error("Missing required widget fields."));
        return;
    }

    if (widgetUrl !== null) {
        // if url is null it is being deleted, don't need to check name/type/etc
        // check types of fields
        if (widgetName !== undefined && typeof widgetName !== "string") {
            sendError(event, _t("Unable to create widget."), new Error("Optional field 'name' must be a string."));
            return;
        }
        if (widgetData !== undefined && !(widgetData instanceof Object)) {
            sendError(event, _t("Unable to create widget."), new Error("Optional field 'data' must be an Object."));
            return;
        }
        if (widgetAvatarUrl !== undefined && typeof widgetAvatarUrl !== "string") {
            sendError(
                event,
                _t("Unable to create widget."),
                new Error("Optional field 'avatar_url' must be a string."),
            );
            return;
        }
        if (typeof widgetType !== "string") {
            sendError(event, _t("Unable to create widget."), new Error("Field 'type' must be a string."));
            return;
        }
        if (typeof widgetUrl !== "string") {
            sendError(event, _t("Unable to create widget."), new Error("Field 'url' must be a string or null."));
            return;
        }
    }

    // convert the widget type to a known widget type
    widgetType = WidgetType.fromString(widgetType);

    if (userWidget) {
        WidgetUtils.setUserWidget(client, widgetId, widgetType, widgetUrl, widgetName, widgetData)
            .then(() => {
                sendResponse(event, {
                    success: true,
                });

                dis.dispatch({ action: "user_widget_updated" });
            })
            .catch((e) => {
                sendError(event, _t("Unable to create widget."), e);
            });
    } else {
        // Room widget
        if (!roomId) {
            sendError(event, _t("Missing roomId."));
            return;
        }
        WidgetUtils.setRoomWidget(
            client,
            roomId,
            widgetId,
            widgetType,
            widgetUrl,
            widgetName,
            widgetData,
            widgetAvatarUrl,
        ).then(
            () => {
                sendResponse(event, {
                    success: true,
                });
            },
            (err) => {
                sendError(event, _t("Failed to send request."), err);
            },
        );
    }
}

function getWidgets(event: MessageEvent<any>, roomId: string | null): void {
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t("You need to be logged in."));
        return;
    }
    let widgetStateEvents: Partial<IEvent>[] = [];

    if (roomId) {
        const room = client.getRoom(roomId);
        if (!room) {
            sendError(event, _t("This room is not recognised."));
            return;
        }
        // XXX: This gets the raw event object (I think because we can't
        // send the MatrixEvent over postMessage?)
        widgetStateEvents = WidgetUtils.getRoomWidgets(room).map((ev) => ev.event);
    }

    // Add user widgets (not linked to a specific room)
    const userWidgets = WidgetUtils.getUserWidgetsArray(client);
    widgetStateEvents = widgetStateEvents.concat(userWidgets);

    sendResponse(event, widgetStateEvents);
}

function getRoomEncState(event: MessageEvent<any>, roomId: string): void {
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t("You need to be logged in."));
        return;
    }
    const room = client.getRoom(roomId);
    if (!room) {
        sendError(event, _t("This room is not recognised."));
        return;
    }
    const roomIsEncrypted = MatrixClientPeg.get().isRoomEncrypted(roomId);

    sendResponse(event, roomIsEncrypted);
}

function setPlumbingState(event: MessageEvent<any>, roomId: string, status: string): void {
    if (typeof status !== "string") {
        throw new Error("Plumbing state status should be a string");
    }
    logger.log(`Received request to set plumbing state to status "${status}" in room ${roomId}`);
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t("You need to be logged in."));
        return;
    }
    client.sendStateEvent(roomId, "m.room.plumbing", { status: status }).then(
        () => {
            sendResponse(event, {
                success: true,
            });
        },
        (err) => {
            sendError(event, err.message ? err.message : _t("Failed to send request."), err);
        },
    );
}

function setBotOptions(event: MessageEvent<any>, roomId: string, userId: string): void {
    logger.log(`Received request to set options for bot ${userId} in room ${roomId}`);
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t("You need to be logged in."));
        return;
    }
    client.sendStateEvent(roomId, "m.room.bot.options", event.data.content, "_" + userId).then(
        () => {
            sendResponse(event, {
                success: true,
            });
        },
        (err) => {
            sendError(event, err.message ? err.message : _t("Failed to send request."), err);
        },
    );
}

async function setBotPower(
    event: MessageEvent<any>,
    roomId: string,
    userId: string,
    level: number,
    ignoreIfGreater?: boolean,
): Promise<void> {
    if (!(Number.isInteger(level) && level >= 0)) {
        sendError(event, _t("Power level must be positive integer."));
        return;
    }

    logger.log(`Received request to set power level to ${level} for bot ${userId} in room ${roomId}.`);
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t("You need to be logged in."));
        return;
    }

    try {
        const powerLevels = await client.getStateEvent(roomId, "m.room.power_levels", "");

        // If the PL is equal to or greater than the requested PL, ignore.
        if (ignoreIfGreater === true) {
            // As per https://matrix.org/docs/spec/client_server/r0.6.0#m-room-power-levels
            const currentPl = powerLevels.users?.[userId] ?? powerLevels.users_default ?? 0;
            if (currentPl >= level) {
                return sendResponse(event, {
                    success: true,
                });
            }
        }
        await client.setPowerLevel(
            roomId,
            userId,
            level,
            new MatrixEvent({
                type: "m.room.power_levels",
                content: powerLevels,
            }),
        );
        return sendResponse(event, {
            success: true,
        });
    } catch (err) {
        sendError(event, err.message ? err.message : _t("Failed to send request."), err);
    }
}

function getMembershipState(event: MessageEvent<any>, roomId: string, userId: string): void {
    logger.log(`membership_state of ${userId} in room ${roomId} requested.`);
    returnStateEvent(event, roomId, "m.room.member", userId);
}

function getJoinRules(event: MessageEvent<any>, roomId: string): void {
    logger.log(`join_rules of ${roomId} requested.`);
    returnStateEvent(event, roomId, "m.room.join_rules", "");
}

function botOptions(event: MessageEvent<any>, roomId: string, userId: string): void {
    logger.log(`bot_options of ${userId} in room ${roomId} requested.`);
    returnStateEvent(event, roomId, "m.room.bot.options", "_" + userId);
}

function getMembershipCount(event: MessageEvent<any>, roomId: string): void {
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t("You need to be logged in."));
        return;
    }
    const room = client.getRoom(roomId);
    if (!room) {
        sendError(event, _t("This room is not recognised."));
        return;
    }
    const count = room.getJoinedMemberCount();
    sendResponse(event, count);
}

function canSendEvent(event: MessageEvent<any>, roomId: string): void {
    const evType = "" + event.data.event_type; // force stringify
    const isState = Boolean(event.data.is_state);
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t("You need to be logged in."));
        return;
    }
    const room = client.getRoom(roomId);
    if (!room) {
        sendError(event, _t("This room is not recognised."));
        return;
    }
    if (room.getMyMembership() !== "join") {
        sendError(event, _t("You are not in this room."));
        return;
    }
    const me = client.credentials.userId!;

    let canSend = false;
    if (isState) {
        canSend = room.currentState.maySendStateEvent(evType, me);
    } else {
        canSend = room.currentState.maySendEvent(evType, me);
    }

    if (!canSend) {
        sendError(event, _t("You do not have permission to do that in this room."));
        return;
    }

    sendResponse(event, true);
}

function returnStateEvent(event: MessageEvent<any>, roomId: string, eventType: string, stateKey: string): void {
    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t("You need to be logged in."));
        return;
    }
    const room = client.getRoom(roomId);
    if (!room) {
        sendError(event, _t("This room is not recognised."));
        return;
    }
    const stateEvent = room.currentState.getStateEvents(eventType, stateKey);
    if (!stateEvent) {
        sendResponse(event, null);
        return;
    }
    sendResponse(event, stateEvent.getContent());
}

async function getOpenIdToken(event: MessageEvent<any>): Promise<void> {
    try {
        const tokenObject = await MatrixClientPeg.get().getOpenIdToken();
        sendResponse(event, tokenObject);
    } catch (ex) {
        logger.warn("Unable to fetch openId token.", ex);
        sendError(event, "Unable to fetch openId token.");
    }
}

async function sendEvent(
    event: MessageEvent<{
        type: string;
        state_key?: string;
        content?: IContent;
    }>,
    roomId: string,
): Promise<void> {
    const eventType = event.data.type;
    const stateKey = event.data.state_key;
    const content = event.data.content;

    if (typeof eventType !== "string") {
        sendError(event, _t("Failed to send event"), new Error("Invalid 'type' in request"));
        return;
    }
    const allowedEventTypes = ["m.widgets", "im.vector.modular.widgets", "io.element.integrations.installations"];
    if (!allowedEventTypes.includes(eventType)) {
        sendError(event, _t("Failed to send event"), new Error("Disallowed 'type' in request"));
        return;
    }

    if (!content || typeof content !== "object") {
        sendError(event, _t("Failed to send event"), new Error("Invalid 'content' in request"));
        return;
    }

    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t("You need to be logged in."));
        return;
    }

    const room = client.getRoom(roomId);
    if (!room) {
        sendError(event, _t("This room is not recognised."));
        return;
    }

    if (stateKey !== undefined) {
        // state event
        try {
            const res = await client.sendStateEvent(roomId, eventType, content, stateKey);
            sendResponse(event, {
                room_id: roomId,
                event_id: res.event_id,
            });
        } catch (e) {
            sendError(event, _t("Failed to send event"), e as Error);
            return;
        }
    } else {
        // message event
        sendError(event, _t("Failed to send event"), new Error("Sending message events is not implemented"));
        return;
    }
}

async function readEvents(
    event: MessageEvent<{
        type: string;
        state_key?: string | boolean;
        limit?: number;
    }>,
    roomId: string,
): Promise<void> {
    const eventType = event.data.type;
    const stateKey = event.data.state_key;
    const limit = event.data.limit;

    if (typeof eventType !== "string") {
        sendError(event, _t("Failed to read events"), new Error("Invalid 'type' in request"));
        return;
    }
    const allowedEventTypes = [
        "m.room.power_levels",
        "m.room.encryption",
        "m.room.member",
        "m.room.name",
        "m.widgets",
        "im.vector.modular.widgets",
        "io.element.integrations.installations",
    ];
    if (!allowedEventTypes.includes(eventType)) {
        sendError(event, _t("Failed to read events"), new Error("Disallowed 'type' in request"));
        return;
    }

    let effectiveLimit: number;
    if (limit !== undefined) {
        if (typeof limit !== "number" || limit < 0) {
            sendError(event, _t("Failed to read events"), new Error("Invalid 'limit' in request"));
            return;
        }
        effectiveLimit = Math.min(limit, Number.MAX_SAFE_INTEGER);
    } else {
        effectiveLimit = Number.MAX_SAFE_INTEGER;
    }

    const client = MatrixClientPeg.get();
    if (!client) {
        sendError(event, _t("You need to be logged in."));
        return;
    }

    const room = client.getRoom(roomId);
    if (!room) {
        sendError(event, _t("This room is not recognised."));
        return;
    }

    if (stateKey !== undefined) {
        // state events
        if (typeof stateKey !== "string" && stateKey !== true) {
            sendError(event, _t("Failed to read events"), new Error("Invalid 'state_key' in request"));
            return;
        }
        // When `true` is passed for state key, get events with any state key.
        const effectiveStateKey = stateKey === true ? undefined : stateKey;

        let events: MatrixEvent[] = [];
        events = events.concat(room.currentState.getStateEvents(eventType, effectiveStateKey as string) || []);
        events = events.slice(0, effectiveLimit);

        sendResponse(event, {
            events: events.map((e) => e.getEffectiveEvent()),
        });
        return;
    } else {
        // message events
        sendError(event, _t("Failed to read events"), new Error("Reading message events is not implemented"));
        return;
    }
}

const onMessage = function (event: MessageEvent<any>): void {
    if (!event.origin) {
        // @ts-ignore - stupid chrome
        event.origin = event.originalEvent.origin;
    }

    // Check that the integrations UI URL starts with the origin of the event
    // This means the URL could contain a path (like /develop) and still be used
    // to validate event origins, which do not specify paths.
    // (See https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
    let configUrl: URL | undefined;
    try {
        if (!openManagerUrl) openManagerUrl = IntegrationManagers.sharedInstance().getPrimaryManager()?.uiUrl;
        configUrl = new URL(openManagerUrl!);
    } catch (e) {
        // No integrations UI URL, ignore silently.
        return;
    }
    let eventOriginUrl: URL;
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

    if (event.data.action === Action.CloseScalar) {
        dis.dispatch({ action: Action.CloseScalar });
        sendResponse(event, null);
        return;
    }

    const roomId = event.data.room_id;
    const userId = event.data.user_id;

    if (!roomId) {
        // These APIs don't require roomId
        if (event.data.action === Action.GetWidgets) {
            getWidgets(event, null);
            return;
        } else if (event.data.action === Action.SetWidget) {
            setWidget(event, null);
            return;
        } else if (event.data.action === Action.GetOpenIdToken) {
            getOpenIdToken(event);
            return;
        } else {
            sendError(event, _t("Missing room_id in request"));
            return;
        }
    }

    if (roomId !== SdkContextClass.instance.roomViewStore.getRoomId()) {
        sendError(event, _t("Room %(roomId)s not visible", { roomId: roomId }));
        return;
    }

    // Get and set room-based widgets
    if (event.data.action === Action.GetWidgets) {
        getWidgets(event, roomId);
        return;
    } else if (event.data.action === Action.SetWidget) {
        setWidget(event, roomId);
        return;
    }

    // These APIs don't require userId
    if (event.data.action === Action.JoinRulesState) {
        getJoinRules(event, roomId);
        return;
    } else if (event.data.action === Action.SetPlumbingState) {
        setPlumbingState(event, roomId, event.data.status);
        return;
    } else if (event.data.action === Action.GetMembershipCount) {
        getMembershipCount(event, roomId);
        return;
    } else if (event.data.action === Action.GetRoomEncryptionState) {
        getRoomEncState(event, roomId);
        return;
    } else if (event.data.action === Action.CanSendEvent) {
        canSendEvent(event, roomId);
        return;
    } else if (event.data.action === Action.SendEvent) {
        sendEvent(event, roomId);
        return;
    } else if (event.data.action === Action.ReadEvents) {
        readEvents(event, roomId);
        return;
    }

    if (!userId) {
        sendError(event, _t("Missing user_id in request"));
        return;
    }
    switch (event.data.action) {
        case Action.MembershipState:
            getMembershipState(event, roomId, userId);
            break;
        case Action.invite:
            inviteUser(event, roomId, userId);
            break;
        case Action.Kick:
            kickUser(event, roomId, userId);
            break;
        case Action.BotOptions:
            botOptions(event, roomId, userId);
            break;
        case Action.SetBotOptions:
            setBotOptions(event, roomId, userId);
            break;
        case Action.SetBotPower:
            setBotPower(event, roomId, userId, event.data.level, event.data.ignoreIfGreater);
            break;
        default:
            logger.warn("Unhandled postMessage event with action '" + event.data.action + "'");
            break;
    }
};

let listenerCount = 0;
let openManagerUrl: string | undefined;

export function startListening(): void {
    if (listenerCount === 0) {
        window.addEventListener("message", onMessage, false);
    }
    listenerCount += 1;
}

export function stopListening(): void {
    listenerCount -= 1;
    if (listenerCount === 0) {
        window.removeEventListener("message", onMessage);
    }
    if (listenerCount < 0) {
        // Make an error so we get a stack trace
        const e = new Error("ScalarMessaging: mismatched startListening / stopListening detected." + " Negative count");
        logger.error(e);
    }
}

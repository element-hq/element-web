/*
Copyright 2017, 2021 The Matrix.org Foundation C.I.C.

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

import { ClientEvent, MatrixClient } from "matrix-js-sdk/src/client";
import { MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/models/event";
import { Room, RoomEvent } from "matrix-js-sdk/src/models/room";
import { IRoomTimelineData } from "matrix-js-sdk/src/models/event-timeline-set";
import { RoomState, RoomStateEvent } from "matrix-js-sdk/src/models/room-state";

import dis from "../dispatcher/dispatcher";
import { ActionPayload } from "../dispatcher/payloads";

/**
 * Create a MatrixActions.sync action that represents a MatrixClient `sync` event,
 * each parameter mapping to a key-value in the action.
 *
 * @param {MatrixClient} matrixClient the matrix client
 * @param {string} state the current sync state.
 * @param {string} prevState the previous sync state.
 * @returns {Object} an action of type MatrixActions.sync.
 */
function createSyncAction(matrixClient: MatrixClient, state: string, prevState: string): ActionPayload {
    return {
        action: "MatrixActions.sync",
        state,
        prevState,
        matrixClient,
    };
}

/**
 * @typedef AccountDataAction
 * @type {Object}
 * @property {string} action 'MatrixActions.accountData'.
 * @property {MatrixEvent} event the MatrixEvent that triggered the dispatch.
 * @property {string} event_type the type of the MatrixEvent, e.g. "m.direct".
 * @property {Object} event_content the content of the MatrixEvent.
 * @property {MatrixEvent} previousEvent the previous account data event of the same type, if present
 */

/**
 * Create a MatrixActions.accountData action that represents a MatrixClient `accountData`
 * matrix event.
 *
 * @param {MatrixClient} matrixClient the matrix client.
 * @param {MatrixEvent} accountDataEvent the account data event.
 * @param {MatrixEvent | undefined} previousAccountDataEvent the previous account data event of the same type, if present
 * @returns {AccountDataAction} an action of type MatrixActions.accountData.
 */
function createAccountDataAction(
    matrixClient: MatrixClient,
    accountDataEvent: MatrixEvent,
    previousAccountDataEvent?: MatrixEvent,
): ActionPayload {
    return {
        action: "MatrixActions.accountData",
        event: accountDataEvent,
        event_type: accountDataEvent.getType(),
        event_content: accountDataEvent.getContent(),
        previousEvent: previousAccountDataEvent,
    };
}

/**
 * @typedef RoomAccountDataAction
 * @type {Object}
 * @property {string} action 'MatrixActions.Room.accountData'.
 * @property {MatrixEvent} event the MatrixEvent that triggered the dispatch.
 * @property {string} event_type the type of the MatrixEvent, e.g. "m.direct".
 * @property {Object} event_content the content of the MatrixEvent.
 * @property {Room} room the room where the account data was changed.
 */

/**
 * Create a MatrixActions.Room.accountData action that represents a MatrixClient `Room.accountData`
 * matrix event.
 *
 * @param {MatrixClient} matrixClient the matrix client.
 * @param {MatrixEvent} accountDataEvent the account data event.
 * @param {Room} room the room where account data was changed
 * @returns {RoomAccountDataAction} an action of type MatrixActions.Room.accountData.
 */
function createRoomAccountDataAction(
    matrixClient: MatrixClient,
    accountDataEvent: MatrixEvent,
    room: Room,
): ActionPayload {
    return {
        action: "MatrixActions.Room.accountData",
        event: accountDataEvent,
        event_type: accountDataEvent.getType(),
        event_content: accountDataEvent.getContent(),
        room: room,
    };
}

/**
 * @typedef RoomAction
 * @type {Object}
 * @property {string} action 'MatrixActions.Room'.
 * @property {Room} room the Room that was stored.
 */

/**
 * Create a MatrixActions.Room action that represents a MatrixClient `Room`
 * matrix event, emitted when a Room is stored in the client.
 *
 * @param {MatrixClient} matrixClient the matrix client.
 * @param {Room} room the Room that was stored.
 * @returns {RoomAction} an action of type `MatrixActions.Room`.
 */
function createRoomAction(matrixClient: MatrixClient, room: Room): ActionPayload {
    return { action: "MatrixActions.Room", room };
}

/**
 * @typedef RoomTagsAction
 * @type {Object}
 * @property {string} action 'MatrixActions.Room.tags'.
 * @property {Room} room the Room whose tags changed.
 */

/**
 * Create a MatrixActions.Room.tags action that represents a MatrixClient
 * `Room.tags` matrix event, emitted when the m.tag room account data
 * event is updated.
 *
 * @param {MatrixClient} matrixClient the matrix client.
 * @param {MatrixEvent} roomTagsEvent the m.tag event.
 * @param {Room} room the Room whose tags were changed.
 * @returns {RoomTagsAction} an action of type `MatrixActions.Room.tags`.
 */
function createRoomTagsAction(matrixClient: MatrixClient, roomTagsEvent: MatrixEvent, room: Room): ActionPayload {
    return { action: "MatrixActions.Room.tags", room };
}

/**
 * Create a MatrixActions.Room.receipt action that represents a MatrixClient
 * `Room.receipt` event, each parameter mapping to a key-value in the action.
 *
 * @param {MatrixClient} matrixClient the matrix client
 * @param {MatrixEvent} event the receipt event.
 * @param {Room} room the room the receipt happened in.
 * @returns {Object} an action of type MatrixActions.Room.receipt.
 */
function createRoomReceiptAction(matrixClient: MatrixClient, event: MatrixEvent, room: Room): ActionPayload {
    return {
        action: "MatrixActions.Room.receipt",
        event,
        room,
        matrixClient,
    };
}

/**
 * @typedef IRoomTimelineActionPayload
 * @type {Object}
 * @property {string} action 'MatrixActions.Room.timeline'.
 * @property {boolean} isLiveEvent whether the event was attached to a
 * live timeline.
 * @property {boolean} isLiveUnfilteredRoomTimelineEvent whether the
 * event was attached to a timeline in the set of unfiltered timelines.
 * @property {Room} room the Room whose tags changed.
 */
export interface IRoomTimelineActionPayload extends Pick<ActionPayload, "action"> {
    action: "MatrixActions.Room.timeline";
    event: MatrixEvent;
    room: Room | null;
    isLiveEvent?: boolean;
    isLiveUnfilteredRoomTimelineEvent: boolean;
}

/**
 * @typedef IRoomStateEventsActionPayload
 * @type {Object}
 * @property {string} action 'MatrixActions.RoomState.events'.
 * @property {MatrixEvent} event the state event received
 * @property {RoomState} state the room state into which the event was applied
 * @property {MatrixEvent | null} lastStateEvent the previous value for this (event-type, state-key) tuple in room state
 */
export interface IRoomStateEventsActionPayload extends Pick<ActionPayload, "action"> {
    action: "MatrixActions.RoomState.events";
    event: MatrixEvent;
    state: RoomState;
    lastStateEvent: MatrixEvent | null;
}

/**
 * Create a MatrixActions.Room.timeline action that represents a
 * MatrixClient `Room.timeline` matrix event, emitted when an event
 * is added to or removed from a timeline of a room.
 *
 * @param {MatrixClient} matrixClient the matrix client.
 * @param {MatrixEvent} timelineEvent the event that was added/removed.
 * @param {?Room} room the Room that was stored.
 * @param {boolean} toStartOfTimeline whether the event is being added
 * to the start (and not the end) of the timeline.
 * @param {boolean} removed whether the event was removed from the
 * timeline.
 * @param {Object} data
 * @param {boolean} data.liveEvent whether the event is a live event,
 * belonging to a live timeline.
 * @param {EventTimeline} data.timeline the timeline being altered.
 * @returns {IRoomTimelineActionPayload} an action of type `MatrixActions.Room.timeline`.
 */
function createRoomTimelineAction(
    matrixClient: MatrixClient,
    timelineEvent: MatrixEvent,
    room: Room | null,
    toStartOfTimeline: boolean,
    removed: boolean,
    data: IRoomTimelineData,
): IRoomTimelineActionPayload {
    return {
        action: "MatrixActions.Room.timeline",
        event: timelineEvent,
        isLiveEvent: data.liveEvent,
        isLiveUnfilteredRoomTimelineEvent: data.timeline.getTimelineSet() === room?.getUnfilteredTimelineSet(),
        room,
    };
}

/**
 * Create a MatrixActions.Room.timeline action that represents a
 * MatrixClient `Room.timeline` matrix event, emitted when an event
 * is added to or removed from a timeline of a room.
 *
 * @param {MatrixClient} matrixClient the matrix client.
 * @param {MatrixEvent} event the state event received
 * @param {RoomState} state the room state into which the event was applied
 * @param {MatrixEvent | null} lastStateEvent the previous value for this (event-type, state-key) tuple in room state
 * @returns {IRoomStateEventsActionPayload} an action of type `MatrixActions.RoomState.events`.
 */
function createRoomStateEventsAction(
    matrixClient: MatrixClient,
    event: MatrixEvent,
    state: RoomState,
    lastStateEvent: MatrixEvent | null,
): IRoomStateEventsActionPayload {
    return {
        action: "MatrixActions.RoomState.events",
        event,
        state,
        lastStateEvent,
    };
}

/**
 * @typedef RoomMembershipAction
 * @type {Object}
 * @property {string} action 'MatrixActions.Room.myMembership'.
 * @property {Room} room to room for which the self-membership changed.
 * @property {string} membership the new membership
 * @property {string} oldMembership the previous membership, can be null.
 */

/**
 * Create a MatrixActions.Room.myMembership action that represents
 * a MatrixClient `Room.myMembership` event for the syncing user,
 * emitted when the syncing user's membership is updated for a room.
 *
 * @param {MatrixClient} matrixClient the matrix client.
 * @param {Room} room to room for which the self-membership changed.
 * @param {string} membership the new membership
 * @param {string} oldMembership the previous membership, can be null.
 * @returns {RoomMembershipAction} an action of type `MatrixActions.Room.myMembership`.
 */
function createSelfMembershipAction(
    matrixClient: MatrixClient,
    room: Room,
    membership: string,
    oldMembership: string,
): ActionPayload {
    return { action: "MatrixActions.Room.myMembership", room, membership, oldMembership };
}

/**
 * @typedef EventDecryptedAction
 * @type {Object}
 * @property {string} action 'MatrixActions.Event.decrypted'.
 * @property {MatrixEvent} event the matrix event that was decrypted.
 */

/**
 * Create a MatrixActions.Event.decrypted action that represents
 * a MatrixClient `Event.decrypted` matrix event, emitted when a
 * matrix event is decrypted.
 *
 * @param {MatrixClient} matrixClient the matrix client.
 * @param {MatrixEvent} event the matrix event that was decrypted.
 * @returns {EventDecryptedAction} an action of type `MatrixActions.Event.decrypted`.
 */
function createEventDecryptedAction(matrixClient: MatrixClient, event: MatrixEvent): ActionPayload {
    return { action: "MatrixActions.Event.decrypted", event };
}

type Listener = () => void;
type ActionCreator = (matrixClient: MatrixClient, ...args: any) => ActionPayload;

// A list of callbacks to call to unregister all listeners added
let matrixClientListenersStop: Listener[] = [];

/**
 * Start listening to events of type eventName on matrixClient and when they are emitted,
 * dispatch an action created by the actionCreator function.
 * @param {MatrixClient} matrixClient a MatrixClient to register a listener with.
 * @param {string} eventName the event to listen to on MatrixClient.
 * @param {function} actionCreator a function that should return an action to dispatch
 *                                 when given the MatrixClient as an argument as well as
 *                                 arguments emitted in the MatrixClient event.
 */
function addMatrixClientListener(
    matrixClient: MatrixClient,
    eventName: Parameters<MatrixClient["emit"]>[0],
    actionCreator: ActionCreator,
): void {
    const listener: Listener = (...args) => {
        const payload = actionCreator(matrixClient, ...args);
        if (payload) {
            // Consumers shouldn't have to worry about calling js-sdk methods mid-dispatch, so make this dispatch async
            dis.dispatch(payload, false);
        }
    };
    matrixClient.on(eventName, listener);
    matrixClientListenersStop.push(() => {
        matrixClient.removeListener(eventName, listener);
    });
}

/**
 * This object is responsible for dispatching actions when certain events are emitted by
 * the given MatrixClient.
 */
export default {
    /**
     * Start listening to certain events from the MatrixClient and dispatch actions when
     * they are emitted.
     * @param {MatrixClient} matrixClient the MatrixClient to listen to events from
     */
    start(matrixClient: MatrixClient) {
        addMatrixClientListener(matrixClient, ClientEvent.Sync, createSyncAction);
        addMatrixClientListener(matrixClient, ClientEvent.AccountData, createAccountDataAction);
        addMatrixClientListener(matrixClient, RoomEvent.AccountData, createRoomAccountDataAction);
        addMatrixClientListener(matrixClient, ClientEvent.Room, createRoomAction);
        addMatrixClientListener(matrixClient, RoomEvent.Tags, createRoomTagsAction);
        addMatrixClientListener(matrixClient, RoomEvent.Receipt, createRoomReceiptAction);
        addMatrixClientListener(matrixClient, RoomEvent.Timeline, createRoomTimelineAction);
        addMatrixClientListener(matrixClient, RoomEvent.MyMembership, createSelfMembershipAction);
        addMatrixClientListener(matrixClient, MatrixEventEvent.Decrypted, createEventDecryptedAction);
        addMatrixClientListener(matrixClient, RoomStateEvent.Events, createRoomStateEventsAction);
    },

    /**
     * Stop listening to events.
     */
    stop() {
        matrixClientListenersStop.forEach((stopListener) => stopListener());
        matrixClientListenersStop = [];
    },
};

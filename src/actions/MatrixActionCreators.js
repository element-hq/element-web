/*
Copyright 2017 New Vector Ltd

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

import dis from '../dispatcher';

// TODO: migrate from sync_state to MatrixActions.sync so that more js-sdk events
//       become dispatches in the same place.
/**
 * Create a MatrixActions.sync action that represents a MatrixClient `sync` event,
 * each parameter mapping to a key-value in the action.
 *
 * @param {MatrixClient} matrixClient the matrix client
 * @param {string} state the current sync state.
 * @param {string} prevState the previous sync state.
 * @returns {Object} an action of type MatrixActions.sync.
 */
function createSyncAction(matrixClient, state, prevState) {
    return {
        action: 'MatrixActions.sync',
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
 */

/**
 * Create a MatrixActions.accountData action that represents a MatrixClient `accountData`
 * matrix event.
 *
 * @param {MatrixClient} matrixClient the matrix client.
 * @param {MatrixEvent} accountDataEvent the account data event.
 * @returns {AccountDataAction} an action of type MatrixActions.accountData.
 */
function createAccountDataAction(matrixClient, accountDataEvent) {
    return {
        action: 'MatrixActions.accountData',
        event: accountDataEvent,
        event_type: accountDataEvent.getType(),
        event_content: accountDataEvent.getContent(),
    };
}

function createRoomTagsAction(matrixClient, roomTagsEvent, room) {
    return { action: 'MatrixActions.Room.tags', room };
}

function createRoomTimelineAction(matrixClient, timelineEvent, room, toStartOfTimeline, removed, data) {
    return {
        action: 'MatrixActions.Room.timeline',
        event: timelineEvent,
        isLiveEvent: data.liveEvent,
    };
}

function createRoomMembershipAction(matrixClient, membershipEvent, member, oldMembership) {
    return { action: 'MatrixActions.RoomMember.membership', member };
}

/**
 * This object is responsible for dispatching actions when certain events are emitted by
 * the given MatrixClient.
 */
export default {
    // A list of callbacks to call to unregister all listeners added
    _matrixClientListenersStop: [],

    /**
     * Start listening to certain events from the MatrixClient and dispatch actions when
     * they are emitted.
     * @param {MatrixClient} matrixClient the MatrixClient to listen to events from
     */
    start(matrixClient) {
        this._addMatrixClientListener(matrixClient, 'sync', createSyncAction);
        this._addMatrixClientListener(matrixClient, 'accountData', createAccountDataAction);
        this._addMatrixClientListener(matrixClient, 'Room.tags', createRoomTagsAction);
        this._addMatrixClientListener(matrixClient, 'Room.timeline', createRoomTimelineAction);
        this._addMatrixClientListener(matrixClient, 'RoomMember.membership', createRoomMembershipAction);
    },

    /**
     * Start listening to events of type eventName on matrixClient and when they are emitted,
     * dispatch an action created by the actionCreator function.
     * @param {MatrixClient} matrixClient a MatrixClient to register a listener with.
     * @param {string} eventName the event to listen to on MatrixClient.
     * @param {function} actionCreator a function that should return an action to dispatch
     *                                 when given the MatrixClient as an argument as well as
     *                                 arguments emitted in the MatrixClient event.
     */
    _addMatrixClientListener(matrixClient, eventName, actionCreator) {
        const listener = (...args) => {
            dis.dispatch(actionCreator(matrixClient, ...args), true);
        };
        matrixClient.on(eventName, listener);
        this._matrixClientListenersStop.push(() => {
            matrixClient.removeListener(eventName, listener);
        });
    },

    /**
     * Stop listening to events.
     */
    stop() {
        this._matrixClientListenersStop.forEach((stopListener) => stopListener());
    },
};

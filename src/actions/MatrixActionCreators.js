/*
Copyright 2017 Vector Creations Ltd

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
 * An action creator that will map a `sync` event to a MatrixActions.sync action,
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
 * An action creator that will map an account data matrix event to a
 * MatrixActions.accountData action.
 *
 * @param {MatrixClient} matrixClient the matrix client with which to
 *                                    register a listener.
 * @param {MatrixEvent} accountDataEvent the account data event.
 * @returns {Object} an action of type MatrixActions.accountData.
 */
function createAccountDataAction(matrixClient, accountDataEvent) {
    return {
        action: 'MatrixActions.accountData',
        event: accountDataEvent,
        event_type: accountDataEvent.getType(),
        event_content: accountDataEvent.getContent(),
    };
}

export default {
    _matrixClientListenersStop: [],

    start(matrixClient) {
        this._addMatrixClientListener(matrixClient, 'sync', createSyncAction);
        this._addMatrixClientListener(matrixClient, 'accountData', createAccountDataAction);
    },

    _addMatrixClientListener(matrixClient, eventName, actionCreator) {
        const listener = (...args) => {
            dis.dispatch(actionCreator(matrixClient, ...args));
        };
        matrixClient.on(eventName, listener);
        this._matrixClientListenersStop.push(() => {
            matrixClient.removeListener(eventName, listener);
        });
    },

    stop() {
        this._matrixClientListenersStop.forEach((stopListener) => stopListener());
    },
};

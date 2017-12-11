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

/**
 * Create an action creator that will dispatch actions asynchronously that
 * indicate the current status of promise returned by the given function, fn.
 * @param {string} id the id to give the dispatched actions. This is given a
 *                   suffix determining whether it is pending, successful or
 *                   a failure.
 * @param {function} fn the function to call with arguments given to the
 *                   returned function. This function should return a Promise.
 * @returns {function} a function that dispatches asynchronous actions when called.
 */
export function createPromiseActionCreator(id, fn) {
    return (...args) => {
        dis.dispatch({action: id + '.pending'});
        fn(...args).then((result) => {
            dis.dispatch({action: id + '.success', result});
        }).catch((err) => {
            dis.dispatch({action: id + '.failure', err});
        });
    };
}

/**
 * Create an action creator that will listen to events of type eventId emitted
 * by matrixClient and dispatch a corresponding action of the following shape:
 *     {
 *         action: 'MatrixActions.' + eventId,
 *         event: matrixEvent,
 *         event_type: matrixEvent.getType(),
 *         event_content: matrixEvent.getContent(),
 *     }
 * @param {MatrixClient} matrixClient the matrix client with which to register
 *                                    a listener.
 * @param {string} eventId the ID of the event that when emitted will cause the
 *                         an action to be dispatched.
 * @returns {function} a function that, when called, will begin to listen to
 *                     dispatches from matrixClient. The result from that
 *                     function can be called to stop listening.
 */
export function createMatrixActionCreator(matrixClient, eventId) {
    const listener = (matrixEvent) => {
        dis.dispatch({
            action: 'MatrixActions.' + eventId,
            event: matrixEvent,
            event_type: matrixEvent.getType(),
            event_content: matrixEvent.getContent(),
        });
    };
    return () => {
        matrixClient.on(eventId, listener);
        return () => {
            matrixClient.removeListener(eventId, listener);
        };
    };
}

// TODO: migrate from sync_state to MatrixSync so that more js-sdk events
//       become dispatches in the same place.
/**
 * Create an action creator that will listen to `sync` events emitted
 * by matrixClient and dispatch a corresponding MatrixSync action. E.g:
 *     {
 *         action: 'MatrixSync',
 *         state: 'SYNCING',
 *         prevState: 'PREPARED'
 *     }
 * @param {MatrixClient} matrixClient the matrix client with which to register
 *                                    a listener.
 * @returns {function} a function that, when called, will begin to listen to
 *                     dispatches from matrixClient. The result from that
 *                     function can be called to stop listening.
 */
export function createMatrixSyncActionCreator(matrixClient) {
    const listener = (state, prevState) => {
        dis.dispatch({
            action: 'MatrixSync',
            state,
            prevState,
            matrixClient,
        });
    };
    return () => {
        matrixClient.on('sync', listener);
        return () => {
            matrixClient.removeListener('sync', listener);
        };
    };
}

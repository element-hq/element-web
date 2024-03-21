/*
Copyright 2017 New Vector Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { AsyncActionFn, AsyncActionPayload } from "../dispatcher/payloads";

/**
 * Create an action thunk that will dispatch actions indicating the current
 * status of the Promise returned by fn.
 *
 * @param {string} id the id to give the dispatched actions. This is given a
 *                    suffix determining whether it is pending, successful or
 *                    a failure.
 * @param {function} fn a function that returns a Promise.
 * @param {function?} pendingFn a function that returns an object to assign
 *                              to the `request` key of the ${id}.pending
 *                              payload.
 * @returns {AsyncActionPayload} an async action payload. Includes a function
 *                     that uses its single argument as a dispatch function
 *                     to dispatch the following actions:
 *                         `${id}.pending` and either
 *                         `${id}.success` or
 *                         `${id}.failure`.
 *
 *                     The shape of each are:
 *                     { action: '${id}.pending', request }
 *                     { action: '${id}.success', result }
 *                     { action: '${id}.failure', err }
 *
 *                     where `request` is returned by `pendingFn` and
 *                     result is the result of the promise returned by
 *                     `fn`.
 */
export function asyncAction(id: string, fn: () => Promise<any>, pendingFn: () => any | null): AsyncActionPayload {
    const helper: AsyncActionFn = (dispatch) => {
        dispatch({
            action: id + ".pending",
            request: typeof pendingFn === "function" ? pendingFn() : undefined,
        });
        fn()
            .then((result) => {
                dispatch({ action: id + ".success", result });
            })
            .catch((err) => {
                dispatch({ action: id + ".failure", err });
            });
    };
    return new AsyncActionPayload(helper);
}

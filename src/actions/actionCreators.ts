/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2017 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type AsyncActionFn, AsyncActionPayload } from "../dispatcher/payloads";

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

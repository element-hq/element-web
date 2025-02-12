/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type DispatcherAction } from "./actions";

/**
 * The base dispatch type exposed by our dispatcher.
 */
export interface ActionPayload {
    [property: string]: any; // effectively makes this 'extends Object'
    action: DispatcherAction;
}

/**
 * The function the dispatcher calls when ready for an AsyncActionPayload. The
 * single argument is used to start a dispatch. First the dispatcher calls the
 * outer function, then when the called function is ready it calls the cb
 * function to issue the dispatch. It may call the callback repeatedly if needed.
 */
export type AsyncActionFn = (cb: (action: ActionPayload) => void) => void;

/**
 * An async version of ActionPayload
 */
export class AsyncActionPayload implements ActionPayload {
    /**
     * The function the dispatcher should call.
     */
    public readonly fn: AsyncActionFn;

    /**
     * @deprecated Not used on AsyncActionPayload.
     */
    public get action(): DispatcherAction {
        return "NOT_USED";
    }

    /**
     * Create a new AsyncActionPayload with the given ready function.
     * @param {AsyncActionFn} readyFn The function to be called when the
     * dispatcher is ready.
     */
    public constructor(readyFn: AsyncActionFn) {
        this.fn = readyFn;
    }
}

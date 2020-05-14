/*
Copyright 2015, 2016 OpenMarket Ltd
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

import { Dispatcher } from "flux";

export enum Action {
    // TODO: Populate with actual actions
}

// Dispatcher actions also extend into any arbitrary string, so support that.
export type DispatcherAction = Action | string;

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

/**
 * A dispatcher for ActionPayloads (the default within the SDK).
 */
export class MatrixDispatcher extends Dispatcher<ActionPayload> {
    /**
     * Dispatches an event on the dispatcher's event bus.
     * @param {ActionPayload} payload Required. The payload to dispatch.
     * @param {boolean=false} sync Optional. Pass true to dispatch
     *        synchronously. This is useful for anything triggering
     *        an operation that the browser requires user interaction
     *        for. Default false (async).
     */
    dispatch(payload: ActionPayload, sync = false) {
        if (payload instanceof AsyncActionPayload) {
            payload.fn((action: ActionPayload) => {
                this.dispatch(action, sync);
            });
            return;
        }

        if (sync) {
            super.dispatch(payload);
        } else {
            // Unless the caller explicitly asked for us to dispatch synchronously,
            // we always set a timeout to do this: The flux dispatcher complains
            // if you dispatch from within a dispatch, so rather than action
            // handlers having to worry about not calling anything that might
            // then dispatch, we just do dispatches asynchronously.
            setTimeout(super.dispatch.bind(this, payload), 0);
        }
    }

    /**
     * Shorthand for dispatch({action: Action.WHATEVER}, sync). No additional
     * properties can be included with this version.
     * @param {Action} action The action to dispatch.
     * @param {boolean=false} sync Whether the dispatch should be sync or not.
     * @see dispatch(action: ActionPayload, sync: boolean)
     */
    fire(action: Action, sync = false) {
        this.dispatch({action}, sync);
    }
}

export const defaultDispatcher = new MatrixDispatcher();

const anyGlobal = <any>global;
if (!anyGlobal.mxDispatcher) {
    anyGlobal.mxDispatcher = defaultDispatcher;
}

export default defaultDispatcher;

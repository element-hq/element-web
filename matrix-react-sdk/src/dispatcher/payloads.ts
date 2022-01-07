/*
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

import { DispatcherAction } from "./actions";

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

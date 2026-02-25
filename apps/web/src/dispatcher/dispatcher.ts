/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2017 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Action } from "./actions";
import { type ActionPayload, AsyncActionPayload } from "./payloads";

type DispatchToken = string;

function invariant(cond: any, error: string): void {
    if (!cond) throw new Error(error);
}

/**
 * A dispatcher for ActionPayloads (the default within the SDK).
 * Based on the old Flux dispatcher https://github.com/facebook/flux/blob/main/src/Dispatcher.js
 */
export class MatrixDispatcher {
    private readonly callbacks = new Map<DispatchToken, (payload: ActionPayload) => void>();
    private readonly isHandled = new Map<DispatchToken, boolean>();
    private readonly isPending = new Map<DispatchToken, boolean>();
    private pendingPayload?: ActionPayload;
    private lastId = 1;

    /**
     * Registers a callback to be invoked with every dispatched payload. Returns
     * a token that can be used with `waitFor()`.
     */
    public register(callback: (payload: ActionPayload) => void): DispatchToken {
        const id = "ID_" + this.lastId++;
        this.callbacks.set(id, callback);
        if (this.isDispatching()) {
            // If there is a dispatch happening right now then the newly registered callback should be skipped
            this.isPending.set(id, true);
            this.isHandled.set(id, true);
        }
        return id;
    }

    /**
     * Removes a callback based on its token.
     * @param id The token that was returned by `register`.
     * Can be undefined to avoid needing an if around every caller.
     */
    public unregister(id: DispatchToken | undefined): void {
        if (!id) return;
        invariant(this.callbacks.has(id), `Dispatcher.unregister(...): '${id}' does not map to a registered callback.`);
        this.callbacks.delete(id);
    }

    /**
     * Waits for the callbacks specified to be invoked before continuing execution
     * of the current callback. This method should only be used by a callback in
     * response to a dispatched payload.
     */
    public waitFor(ids: DispatchToken[]): void {
        invariant(this.isDispatching(), "Dispatcher.waitFor(...): Must be invoked while dispatching.");
        for (const id of ids) {
            if (this.isPending.get(id)) {
                invariant(
                    this.isHandled.get(id),
                    `Dispatcher.waitFor(...): Circular dependency detected while waiting for '${id}'.`,
                );
                continue;
            }
            invariant(
                this.callbacks.get(id),
                `Dispatcher.waitFor(...): '${id}' does not map to a registered callback.`,
            );
            this.invokeCallback(id);
        }
    }

    /**
     * Dispatches a payload to all registered callbacks.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    private _dispatch = (payload: ActionPayload): void => {
        invariant(!this.isDispatching(), "Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch.");
        this.startDispatching(payload);
        try {
            for (const [id] of this.callbacks) {
                if (this.isPending.get(id)) {
                    continue;
                }
                this.invokeCallback(id);
            }
        } finally {
            this.stopDispatching();
        }
    };

    /**
     * Is this Dispatcher currently dispatching.
     */
    public isDispatching(): boolean {
        return !!this.pendingPayload;
    }

    /**
     * Call the callback stored with the given id. Also do some internal
     * bookkeeping.
     *
     * Must only be called with an id which has a callback and pendingPayload set
     * @internal
     */
    private invokeCallback(id: DispatchToken): void {
        this.isPending.set(id, true);
        this.callbacks.get(id)!(this.pendingPayload!);
        this.isHandled.set(id, true);
    }

    /**
     * Set up bookkeeping needed when dispatching.
     *
     * @internal
     */
    private startDispatching(payload: ActionPayload): void {
        for (const [id] of this.callbacks) {
            this.isPending.set(id, false);
            this.isHandled.set(id, false);
        }
        this.pendingPayload = payload;
    }

    /**
     * Clear bookkeeping used for dispatching.
     *
     * @internal
     */
    private stopDispatching(): void {
        this.pendingPayload = undefined;
    }

    /**
     * Dispatches an event on the dispatcher's event bus.
     * @param {ActionPayload} payload Required. The payload to dispatch.
     * @param {boolean=false} sync Optional. Pass true to dispatch
     *        synchronously. This is useful for anything triggering
     *        an operation that the browser requires user interaction
     *        for. Default false (async).
     */
    public dispatch<T extends ActionPayload>(payload: T, sync = false): void {
        if (payload instanceof AsyncActionPayload) {
            payload.fn((action: ActionPayload) => {
                this.dispatch(action, sync);
            });
            return;
        }

        if (sync) {
            this._dispatch(payload);
        } else {
            // Unless the caller explicitly asked for us to dispatch synchronously,
            // we always set a timeout to do this: The flux dispatcher complains
            // if you dispatch from within a dispatch, so rather than action
            // handlers having to worry about not calling anything that might
            // then dispatch, we just do dispatches asynchronously.
            window.setTimeout(this._dispatch, 0, payload);
        }
    }

    /**
     * Shorthand for dispatch({action: Action.WHATEVER}, sync). No additional
     * properties can be included with this version.
     * @param {Action} action The action to dispatch.
     * @param {boolean=false} sync Whether the dispatch should be sync or not.
     * @see dispatch(action: ActionPayload, sync: boolean)
     */
    public fire(action: Action, sync = false): void {
        this.dispatch({ action }, sync);
    }
}

const defaultDispatcher = new MatrixDispatcher();

if (!window.mxDispatcher) {
    window.mxDispatcher = defaultDispatcher;
}

export default defaultDispatcher;

/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventEmitter } from "events";
import AwaitLock from "await-lock";

import { type ActionPayload } from "../dispatcher/payloads";
import { type MatrixDispatcher } from "../dispatcher/dispatcher";

/**
 * The event/channel to listen for in an AsyncStore.
 */
export const UPDATE_EVENT = "update";

/**
 * Represents a minimal store which works similar to Flux stores. Instead
 * of everything needing to happen in a dispatch cycle, everything can
 * happen async to that cycle.
 *
 * The store operates by using Object.assign() to mutate state - it sends the
 * state objects (current and new) through the function onto a new empty
 * object. Because of this, it is recommended to break out your state to be as
 * safe as possible. The state mutations are also locked, preventing concurrent
 * writes.
 *
 * All updates to the store happen on the UPDATE_EVENT event channel with the
 * one argument being the instance of the store.
 *
 * To update the state, use updateState() and preferably await the result to
 * help prevent lock conflicts.
 */
export abstract class AsyncStore<T extends object> extends EventEmitter {
    private storeState: Readonly<T>;
    private lock = new AwaitLock();
    private readonly dispatcherRef: string;

    /**
     * Creates a new AsyncStore using the given dispatcher.
     * @param {Dispatcher<ActionPayload>} dispatcher The dispatcher to rely upon.
     * @param {T} initialState The initial state for the store.
     */
    protected constructor(
        private dispatcher: MatrixDispatcher,
        initialState: T = <T>{},
    ) {
        super();

        this.dispatcherRef = dispatcher.register(this.onDispatch.bind(this));
        this.storeState = initialState;
    }

    /**
     * The current state of the store. Cannot be mutated.
     */
    protected get state(): T {
        return this.storeState;
    }

    /**
     * Stops the store's listening functions, such as the listener to the dispatcher.
     */
    protected stop(): void {
        this.dispatcher.unregister(this.dispatcherRef);
    }

    /**
     * Updates the state of the store.
     * @param {T|*} newState The state to update in the store using Object.assign()
     */
    protected async updateState(newState: T | object): Promise<void> {
        await this.lock.acquireAsync();
        try {
            this.storeState = Object.freeze(Object.assign(<T>{}, this.storeState, newState));
            this.emit(UPDATE_EVENT, this);
        } finally {
            await this.lock.release();
        }
    }

    /**
     * Resets the store's to the provided state or an empty object.
     * @param {T|*} newState The new state of the store.
     * @param {boolean} quiet If true, the function will not raise an UPDATE_EVENT.
     */
    protected async reset(newState: T | object | null = null, quiet = false): Promise<void> {
        await this.lock.acquireAsync();
        try {
            this.storeState = Object.freeze(<T>(newState || {}));
            if (!quiet) this.emit(UPDATE_EVENT, this);
        } finally {
            await this.lock.release();
        }
    }

    /**
     * Called when the dispatcher broadcasts a dispatch event.
     * @param {ActionPayload} payload The event being dispatched.
     */
    protected abstract onDispatch(payload: ActionPayload): void;
}

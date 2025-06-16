/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useRef, useEffect, useState, useCallback, type DependencyList } from "react";
import { type ListenerMap, type TypedEventEmitter } from "matrix-js-sdk/src/matrix";

import type { EventEmitter } from "events";

type Handler = (...args: any[]) => void;

export function useTypedEventEmitter<Events extends string, Arguments extends ListenerMap<Events>>(
    emitter: TypedEventEmitter<Events, Arguments> | undefined,
    eventName: Events,
    handler: Handler,
): void {
    useEventEmitter(emitter, eventName, handler);
}

/**
 * Hook to wrap an EventEmitter on and off in hook lifecycle
 */
export function useEventEmitter(emitter: EventEmitter | undefined, eventName: string | symbol, handler: Handler): void {
    // Create a ref that stores handler
    const savedHandler = useRef(handler);

    // Update ref.current value if handler changes.
    useEffect(() => {
        savedHandler.current = handler;
    }, [handler]);

    useEffect(
        () => {
            // allow disabling this hook by passing a falsy emitter
            if (!emitter) return;

            // Create event listener that calls handler function stored in ref
            const eventListener = (...args: any[]): void => savedHandler.current(...args);

            // Add event listener
            emitter.on(eventName, eventListener);

            // Remove event listener on cleanup
            return () => {
                emitter.off(eventName, eventListener);
            };
        },
        [eventName, emitter], // Re-run if eventName or emitter changes
    );
}

type Mapper<T> = (...args: any[]) => T;

/**
 * {@link useEventEmitterState}
 */
export function useTypedEventEmitterState<T, Events extends string, Arguments extends ListenerMap<Events>>(
    emitter: TypedEventEmitter<Events, Arguments> | undefined,
    eventName: Events,
    fn: Mapper<T>,
): T {
    return useEventEmitterState<T>(emitter, eventName, fn);
}

/**
 * Creates a state, that can be updated by events.
 *
 * @param emitter The emitter sending the event
 * @param eventName Event name to listen for
 * @param fn The callback function, that should return the state value.
 *           It should have the signature of the event callback, except that all parameters are optional.
 *           If the params are not set, a default value for the state should be returned.
 * @returns State
 */
export function useEventEmitterState<T>(
    emitter: EventEmitter | undefined,
    eventName: string | symbol,
    fn: Mapper<T>,
): T {
    const [value, setValue] = useState<T>(fn);
    const handler = useCallback(
        (...args: any[]) => {
            setValue(fn(...args));
        },
        [fn],
    );
    // re-run when the emitter changes
    useEffect(handler, [emitter]); // eslint-disable-line react-hooks/exhaustive-deps
    useEventEmitter(emitter, eventName, handler);
    return value;
}

/**
 * The return value of the callback function for `useEventEmitterAsyncState`.
 */
export type AsyncStateCallbackResult<T> = Promise<T | NoChange>;

/**
 * Creates a state, which is computed asynchronously, and can be updated by events.
 *
 * Similar to `useEventEmitterState`, but the callback is `async`.
 *
 * If the event is emitted while the callback is running, it will wait until
 * after the callback completes before calling the callback again. If the event
 * is emitted multiple times while the callback is running, the callback will be
 * called once for each time the event was emitted, in the order that the events
 * were emitted.
 *
 * @param emitter The emitter sending the event
 * @param eventName Event name to listen for
 * @param fn The callback function, that should return the state value.
 *           It should have the signature of the event callback, except that all
 *           parameters are optional. If the params are not set, a default value
 *           for the state should be returned. If the state value should not
 *           change from its previous value, the function can return a `NoChange`
 *           object.
 * @param deps The dependencies of the callback function.
 * @param initialValue The initial value of the state, before the callback finishes its initial run.
 * @returns State
 */
export function useEventEmitterAsyncState<T, Events extends string, Arguments extends ListenerMap<Events>>(
    emitter: TypedEventEmitter<Events, Arguments> | undefined,
    eventName: string | symbol,
    fn: Mapper<AsyncStateCallbackResult<T>>,
    deps: DependencyList,
    initialValue: T,
): T;
export function useEventEmitterAsyncState<T, Events extends string, Arguments extends ListenerMap<Events>>(
    emitter: TypedEventEmitter<Events, Arguments> | undefined,
    eventName: string | symbol,
    fn: Mapper<AsyncStateCallbackResult<T>>,
    deps: DependencyList,
    initialValue?: T,
): T | undefined;
export function useEventEmitterAsyncState<T, Events extends string, Arguments extends ListenerMap<Events>>(
    emitter: TypedEventEmitter<Events, Arguments> | undefined,
    eventName: string | symbol,
    fn: Mapper<AsyncStateCallbackResult<T>>,
    deps: DependencyList,
    initialValue?: T,
): T | undefined {
    const [value, setValue] = useState<T | undefined>(initialValue);

    let running = false;
    // If the handler is called while it's already running, we remember the
    // arguments that it was called with, and call the handler again when the
    // first call is done.
    const rerunArgs: any[] = [];

    const handler = useCallback(
        (...args: any[]) => {
            if (running) {
                // We're already running, so remember the arguments we were
                // called with, so that we can call the handler again when we're
                // done.
                rerunArgs.push(args);
                return;
            }
            running = true; // eslint-disable-line react-hooks/exhaustive-deps
            // Note: We need to use .then notation instead of async/await,
            // because async/await would cause this function to return a
            // promise, which `useEffect` doesn't like.
            fn(...args)
                .then((v) => {
                    if (!(v instanceof NoChange)) {
                        setValue(v);
                    }
                })
                .finally(() => {
                    running = false;
                    if (rerunArgs.length != 0) {
                        handler(...rerunArgs.shift());
                    }
                });
        },
        [fn, ...deps], // eslint-disable-line react-compiler/react-compiler
    );

    // re-run when the emitter changes
    useEffect(handler, [emitter, handler, ...deps]);
    useEventEmitter(emitter, eventName, handler);
    return value;
}

/**
 * Indicates that the callback for `useEventEmitterAsyncState` is not changing the value of the state.
 */
export class NoChange {}

/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useRef, useEffect, useState, useCallback } from "react";
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

/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

// eslint-disable-next-line no-restricted-imports
import { EventEmitter } from "events";

/** Events emitted by EventEmitter itself */
export enum EventEmitterEvents {
    NewListener = "newListener",
    RemoveListener = "removeListener",
    Error = "error",
}

type AnyListener = (...args: any) => any;

/** Base class for types mapping from event name to the type of listeners to that event */
export type ListenerMap<E extends string> = { [eventName in E]: AnyListener };

type EventEmitterEventListener = (eventName: string, listener: AnyListener) => void;
type EventEmitterErrorListener = (error: Error) => void;

/**
 * The expected type of a listener function for a particular event.
 *
 * Type parameters:
 *   * `E` - List of all events emitted by the `TypedEventEmitter`. Normally an enum type.
 *   * `A` - A type providing mappings from event names to listener types.
 *   * `T` - The name of the actual event that this listener is for. Normally one of the types in `E` or
 *           {@link EventEmitterEvents}.
 */
export type Listener<E extends string, A extends ListenerMap<E>, T extends E | EventEmitterEvents> = T extends E
    ? A[T]
    : T extends EventEmitterEvents
    ? EventEmitterErrorListener
    : EventEmitterEventListener;

/**
 * Typed Event Emitter class which can act as a Base Model for all our model
 * and communication events.
 * This makes it much easier for us to distinguish between events, as we now need
 * to properly type this, so that our events are not stringly-based and prone
 * to silly typos.
 *
 * Type parameters:
 *  * `Events` - List of all events emitted by this `TypedEventEmitter`. Normally an enum type.
 *  * `Arguments` - A {@link ListenerMap} type providing mappings from event names to listener types.
 *  * `SuperclassArguments` - TODO: not really sure. Alternative listener mappings, I think? But only honoured for `.emit`?
 */
export class TypedEventEmitter<
    Events extends string,
    Arguments extends ListenerMap<Events>,
    SuperclassArguments extends ListenerMap<any> = Arguments,
> extends EventEmitter {
    /**
     * Alias for {@link TypedEventEmitter#on}.
     */
    public addListener<T extends Events | EventEmitterEvents>(
        event: T,
        listener: Listener<Events, Arguments, T>,
    ): this {
        return super.addListener(event, listener);
    }

    /**
     * Synchronously calls each of the listeners registered for the event named
     * `event`, in the order they were registered, passing the supplied arguments
     * to each.
     *
     * @param event - The name of the event to emit
     * @param args - Arguments to pass to the listener
     * @returns `true` if the event had listeners, `false` otherwise.
     */
    public emit<T extends Events>(event: T, ...args: Parameters<SuperclassArguments[T]>): boolean;
    public emit<T extends Events>(event: T, ...args: Parameters<Arguments[T]>): boolean;
    public emit<T extends Events>(event: T, ...args: any[]): boolean {
        return super.emit(event, ...args);
    }

    /**
     * Similar to `emit` but calls all listeners within a `Promise.all` and returns the promise chain
     * @param event - The name of the event to emit
     * @param args - Arguments to pass to the listener
     * @returns `true` if the event had listeners, `false` otherwise.
     */
    public async emitPromised<T extends Events>(
        event: T,
        ...args: Parameters<SuperclassArguments[T]>
    ): Promise<boolean>;
    public async emitPromised<T extends Events>(event: T, ...args: Parameters<Arguments[T]>): Promise<boolean>;
    public async emitPromised<T extends Events>(event: T, ...args: any[]): Promise<boolean> {
        const listeners = this.listeners(event);
        return Promise.allSettled(listeners.map((l) => l(...args))).then(() => {
            return listeners.length > 0;
        });
    }

    /**
     * Returns the number of listeners listening to the event named `event`.
     *
     * @param event - The name of the event being listened for
     */
    public listenerCount(event: Events | EventEmitterEvents): number {
        return super.listenerCount(event);
    }

    /**
     * Returns a copy of the array of listeners for the event named `event`.
     */
    public listeners(event: Events | EventEmitterEvents): Function[] {
        return super.listeners(event);
    }

    /**
     * Alias for {@link TypedEventEmitter#removeListener}
     */
    public off<T extends Events | EventEmitterEvents>(event: T, listener: Listener<Events, Arguments, T>): this {
        return super.off(event, listener);
    }

    /**
     * Adds the `listener` function to the end of the listeners array for the
     * event named `event`.
     *
     * No checks are made to see if the `listener` has already been added. Multiple calls
     * passing the same combination of `event` and `listener` will result in the `listener`
     * being added, and called, multiple times.
     *
     * By default, event listeners are invoked in the order they are added. The
     * {@link TypedEventEmitter#prependListener} method can be used as an alternative to add the
     * event listener to the beginning of the listeners array.
     *
     * @param event - The name of the event.
     * @param listener - The callback function
     *
     * @returns a reference to the `EventEmitter`, so that calls can be chained.
     */
    public on<T extends Events | EventEmitterEvents>(event: T, listener: Listener<Events, Arguments, T>): this {
        return super.on(event, listener);
    }

    /**
     * Adds a **one-time** `listener` function for the event named `event`. The
     * next time `event` is triggered, this listener is removed and then invoked.
     *
     * Returns a reference to the `EventEmitter`, so that calls can be chained.
     *
     * By default, event listeners are invoked in the order they are added.
     * The {@link TypedEventEmitter#prependOnceListener} method can be used as an alternative to add the
     * event listener to the beginning of the listeners array.
     *
     * @param event - The name of the event.
     * @param listener - The callback function
     *
     * @returns a reference to the `EventEmitter`, so that calls can be chained.
     */
    public once<T extends Events | EventEmitterEvents>(event: T, listener: Listener<Events, Arguments, T>): this {
        return super.once(event, listener);
    }

    /**
     * Adds the `listener` function to the _beginning_ of the listeners array for the
     * event named `event`.
     *
     * No checks are made to see if the `listener` has already been added. Multiple calls
     * passing the same combination of `event` and `listener` will result in the `listener`
     * being added, and called, multiple times.
     *
     * @param event - The name of the event.
     * @param listener - The callback function
     *
     * @returns a reference to the `EventEmitter`, so that calls can be chained.
     */
    public prependListener<T extends Events | EventEmitterEvents>(
        event: T,
        listener: Listener<Events, Arguments, T>,
    ): this {
        return super.prependListener(event, listener);
    }

    /**
     * Adds a **one-time**`listener` function for the event named `event` to the _beginning_ of the listeners array.
     * The next time `event` is triggered, this listener is removed, and then invoked.
     *
     * @param event - The name of the event.
     * @param listener - The callback function
     *
     * @returns a reference to the `EventEmitter`, so that calls can be chained.
     */
    public prependOnceListener<T extends Events | EventEmitterEvents>(
        event: T,
        listener: Listener<Events, Arguments, T>,
    ): this {
        return super.prependOnceListener(event, listener);
    }

    /**
     * Removes all listeners, or those of the specified `event`.
     *
     * It is bad practice to remove listeners added elsewhere in the code,
     * particularly when the `EventEmitter` instance was created by some other
     * component or module (e.g. sockets or file streams).
     *
     * @param event - The name of the event. If undefined, all listeners everywhere are removed.
     * @returns a reference to the `EventEmitter`, so that calls can be chained.
     */
    public removeAllListeners(event?: Events | EventEmitterEvents): this {
        return super.removeAllListeners(event);
    }

    /**
     * Removes the specified `listener` from the listener array for the event named `event`.
     *
     * @returns a reference to the `EventEmitter`, so that calls can be chained.
     */
    public removeListener<T extends Events | EventEmitterEvents>(
        event: T,
        listener: Listener<Events, Arguments, T>,
    ): this {
        return super.removeListener(event, listener);
    }

    /**
     * Returns a copy of the array of listeners for the event named `eventName`,
     * including any wrappers (such as those created by `.once()`).
     */
    public rawListeners(event: Events | EventEmitterEvents): Function[] {
        return super.rawListeners(event);
    }
}

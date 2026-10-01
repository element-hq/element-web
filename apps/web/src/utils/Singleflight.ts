/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EnhancedMap } from "./maps";

// Inspired by https://pkg.go.dev/golang.org/x/sync/singleflight

const keyMap = new EnhancedMap<object, EnhancedMap<string, unknown>>();

/**
 * Access class to get a singleflight context. Singleflights execute a
 * function exactly once, unless instructed to forget about a result.
 *
 * Typically this is used to de-duplicate an action, such as a save button
 * being pressed, without having to track state internally for an operation
 * already being in progress. This doesn't expose a flag which can be used
 * to disable a button, however it would be capable of returning a Promise
 * from the first call.
 *
 * The result of the function call is cached indefinitely, just in case a
 * second call comes through late. There are various functions named "forget"
 * to have the cache be cleared of a result.
 *
 * Singleflights in our use case are tied to an instance of something, combined
 * with a string key to differentiate between multiple possible actions. This
 * means that a "save" key will be scoped to the instance which defined it and
 * not leak between other instances. This is done to avoid having to concatenate
 * variables to strings to essentially namespace the field, for most cases.
 */
export class Singleflight {
    private constructor() {}

    /**
     * A void marker to help with returning a value in a singleflight context.
     * If your code doesn't return anything, return this instead.
     */
    public static Void = Symbol("void");

    /**
     * Acquire a singleflight context.
     * @param {Object} instance An instance to associate the context with. Can be any object.
     * @param {string} key A string key relevant to that instance to namespace under.
     * @returns {SingleflightContext} Returns the context to execute the function.
     */
    public static for(instance?: object | null, key?: string | null): SingleflightContext {
        if (!instance || !key) throw new Error("An instance and key must be supplied");
        return new SingleflightContext(instance, key);
    }

    /**
     * Forgets all results for a given instance.
     * @param {Object} instance The instance to forget about.
     */
    public static forgetAllFor(instance: object): void {
        keyMap.delete(instance);
    }

    /**
     * Forgets all cached results for all instances. Intended for use by tests.
     */
    public static forgetAll(): void {
        for (const k of keyMap.keys()) {
            keyMap.remove(k);
        }
    }
}

class SingleflightContext {
    public constructor(
        private instance: object,
        private key: string,
    ) {}

    /**
     * Forget this particular instance and key combination, discarding the result.
     */
    public forget(): void {
        const map = keyMap.get(this.instance);
        if (!map) return;
        map.remove(this.key);
        if (!map.size) keyMap.remove(this.instance);
    }

    /**
     * Execute a function. If a result is already known, that will be returned instead
     * of executing the provided function. However, if no result is known then the function
     * will be called, with its return value cached. The function must return a value
     * other than `undefined` - take a look at Singleflight.Void if you don't have a return
     * to make.
     *
     * Note that this technically allows the caller to provide a different function each time:
     * this is largely considered a bad idea and should not be done. Singleflights work off the
     * premise that something needs to happen once, so duplicate executions will be ignored.
     *
     * For ideal performance and behaviour, functions which return promises are preferred. If
     * a function is not returning a promise, it should return as soon as possible to avoid a
     * second call potentially racing it. The promise returned by this function will be that
     * of the first execution of the function, even on duplicate calls.
     * @param {Function} fn The function to execute.
     * @returns The recorded value.
     */
    public do<T>(fn: () => T): T {
        const map = keyMap.getOrCreate(this.instance, new EnhancedMap<string, unknown>());

        // We have to manually getOrCreate() because we need to execute the fn
        let val = <T>map.get(this.key);
        if (val === undefined) {
            val = fn();
            map.set(this.key, val);
        }

        return val;
    }
}

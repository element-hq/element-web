/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

import { type IDestroyable } from "./IDestroyable";
import { arrayFastClone } from "./arrays";

export type WhenFn<T extends string | number> = (w: Whenable<T>) => void;

/**
 * Whenables are a cheap way to have Observable patterns mixed with typical
 * usage of Promises, without having to tear down listeners or calls. Whenables
 * are intended to be used when a condition will be met multiple times and
 * the consumer needs to know *when* that happens.
 */
export abstract class Whenable<T extends string | number> implements IDestroyable {
    private listeners: { condition: T | null; fn: WhenFn<T> }[] = [];

    /**
     * Sets up a call to `fn` *when* the `condition` is met.
     * @param condition The condition to match.
     * @param fn The function to call.
     * @returns This.
     */
    public when(condition: T, fn: WhenFn<T>): Whenable<T> {
        this.listeners.push({ condition, fn });
        return this;
    }

    /**
     * Sets up a call to `fn` *when* any of the `conditions` are met.
     * @param conditions The conditions to match.
     * @param fn The function to call.
     * @returns This.
     */
    public whenAnyOf(conditions: T[], fn: WhenFn<T>): Whenable<T> {
        for (const condition of conditions) {
            this.when(condition, fn);
        }
        return this;
    }

    /**
     * Sets up a call to `fn` *when* any condition is met.
     * @param fn The function to call.
     * @returns This.
     */
    public whenAnything(fn: WhenFn<T>): Whenable<T> {
        this.listeners.push({ condition: null, fn });
        return this;
    }

    /**
     * Notifies all the listeners of a given condition.
     * @param condition The new condition that has been met.
     */
    protected notifyCondition(condition: T): void {
        const listeners = arrayFastClone(this.listeners); // clone just in case the handler modifies us
        for (const listener of listeners) {
            if (listener.condition === null || listener.condition === condition) {
                try {
                    listener.fn(this);
                } catch (e) {
                    logger.error(`Error calling whenable listener for ${condition}:`, e);
                }
            }
        }
    }

    public destroy(): void {
        this.listeners = [];
    }
}

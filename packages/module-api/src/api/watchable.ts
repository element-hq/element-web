/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useState } from "react";

type WatchFn<T> = (value: T) => void;

function shallowCompare<T extends object>(obj1: T, obj2: T): boolean {
    return (
        Object.keys(obj1).length === Object.keys(obj2).length &&
        Object.keys(obj1).every((key) => obj1[key as keyof T] === obj2[key as keyof T])
    );
}

function isObject(value: unknown): value is object {
    return value !== null && typeof value === "object";
}

/**
 * Utility class to wrap a value and allow listeners to be notified when the value changes.
 * If T is an object, it will use a shallow comparison to determine if the value has changed.
 * @public
 */
export class Watchable<T> {
    protected readonly listeners = new Set<WatchFn<T>>();

    public constructor(private currentValue: T) {}

    /**
     * The value stored in this watchable.
     * Warning: Could potentially return stale data if you haven't called {@link Watchable#watch}.
     */
    public get value(): T {
        return this.currentValue;
    }

    public set value(value: T) {
        // If the value hasn't changed, do nothing.
        if (value === this.currentValue) {
            return;
        }
        if (isObject(value) && isObject(this.currentValue) && shallowCompare(this.currentValue as object, value)) {
            return;
        }

        this.currentValue = value;
        for (const listener of this.listeners) {
            listener(this.currentValue);
        }
    }

    public watch(listener: (value: T) => void): void {
        // Call onFirstWatch if there was no listener before.
        if (this.listeners.size === 0) {
            this.onFirstWatch();
        }
        this.listeners.add(listener);
    }

    public unwatch(listener: (value: T) => void): void {
        const hasDeleted = this.listeners.delete(listener);
        // Call onLastWatch if every listener has been removed.
        if (hasDeleted && this.listeners.size === 0) {
            this.onLastWatch();
        }
    }

    /**
     * This is called when the number of listeners go from zero to one.
     * Could be used to add external event listeners.
     */
    protected onFirstWatch(): void {}

    /**
     * This is called when the number of listeners go from one to zero.
     * Could be used to remove external event listeners.
     */
    protected onLastWatch(): void {}
}

/**
 * A React hook to use an updated Watchable value.
 * @param watchable - The Watchable instance to watch.
 * @returns The live value of the Watchable.
 * @public
 */
export function useWatchable<T>(watchable: Watchable<T>): T {
    const [value, setValue] = useState<T>(watchable.value);
    useEffect(() => {
        setValue(watchable.value);
        watchable.watch(setValue);
        return (): void => {
            watchable.unwatch(setValue);
        };
    }, [watchable]);
    return value;
}

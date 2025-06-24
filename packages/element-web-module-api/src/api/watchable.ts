/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

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
    private readonly listeners = new Set<WatchFn<T>>();

    public constructor(private currentValue: T) {}

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
        this.listeners.add(listener);
    }

    public unwatch(listener: (value: T) => void): void {
        this.listeners.delete(listener);
    }
}

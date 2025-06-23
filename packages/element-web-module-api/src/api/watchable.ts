/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

type WatchFn<T> = (value: T) => void;

/**
 * Utility class to wrap a value and allow listeners to be notified when the value changes.
 */
export class Watchable<T> {
    private readonly listeners = new Set<WatchFn<T>>();

    public constructor(private currentValue: T) {}

    public get value(): T {
        return this.currentValue;
    }

    public set value(value: T) {
        if (this.currentValue !== value) {
            this.currentValue = value;
            for (const listener of this.listeners) {
                listener(this.currentValue);
            }
        }
    }

    public watch(listener: (value: T) => void): void {
        this.listeners.add(listener);
    }

    public unwatch(listener: (value: T) => void): void {
        this.listeners.delete(listener);
    }
}

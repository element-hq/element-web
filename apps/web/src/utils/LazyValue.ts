/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Utility class for lazily getting a variable.
 */
export class LazyValue<T> {
    private val?: T;
    private prom?: Promise<T>;
    private done = false;

    public constructor(private getFn: () => Promise<T>) {}

    /**
     * Whether or not a cached value is present.
     */
    public get present(): boolean {
        // we use a tracking variable just in case the final value is falsy
        return this.done;
    }

    /**
     * Gets the value without invoking a get. May be undefined until the
     * value is fetched properly.
     */
    public get cachedValue(): T | undefined {
        return this.val;
    }

    /**
     * Gets a promise which resolves to the value, eventually.
     */
    public get value(): Promise<T> {
        if (this.prom) return this.prom;
        this.prom = this.getFn();

        return this.prom.then((v) => {
            this.val = v;
            this.done = true;
            return v;
        });
    }
}

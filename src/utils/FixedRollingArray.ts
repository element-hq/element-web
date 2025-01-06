/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { arrayFastClone, arraySeed } from "./arrays";

/**
 * An array which is of fixed length and accepts rolling values. Values will
 * be inserted on the left, falling off the right.
 */
export class FixedRollingArray<T> {
    private samples: T[] = [];

    /**
     * Creates a new fixed rolling array.
     * @param width The width of the array.
     * @param padValue The value to seed the array with.
     */
    public constructor(
        private width: number,
        padValue: T,
    ) {
        this.samples = arraySeed(padValue, this.width);
    }

    /**
     * The array, as a fixed length.
     */
    public get value(): T[] {
        return this.samples;
    }

    /**
     * Pushes a value to the array.
     * @param value The value to push.
     */
    public pushValue(value: T): void {
        let swap = arrayFastClone(this.samples);
        swap.splice(0, 0, value);
        if (swap.length > this.width) {
            swap = swap.slice(0, this.width);
        }
        this.samples = swap;
    }
}

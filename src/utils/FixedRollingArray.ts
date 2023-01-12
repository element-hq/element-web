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
    public constructor(private width: number, padValue: T) {
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

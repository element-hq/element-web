/*
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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

import { percentageOf, percentageWithin } from "./numbers";

/**
 * Quickly resample an array to have less/more data points. If an input which is larger
 * than the desired size is provided, it will be downsampled. Similarly, if the input
 * is smaller than the desired size then it will be upsampled.
 * @param {number[]} input The input array to resample.
 * @param {number} points The number of samples to end up with.
 * @returns {number[]} The resampled array.
 */
export function arrayFastResample(input: number[], points: number): number[] {
    if (input.length === points) return input; // short-circuit a complicated call

    // Heavily inspired by matrix-media-repo (used with permission)
    // https://github.com/turt2live/matrix-media-repo/blob/abe72c87d2e29/util/util_audio/fastsample.go#L10
    const samples: number[] = [];
    if (input.length > points) {
        // Danger: this loop can cause out of memory conditions if the input is too small.
        const everyNth = Math.round(input.length / points);
        for (let i = 0; i < input.length; i += everyNth) {
            samples.push(input[i]);
        }
    } else {
        // Smaller inputs mean we have to spread the values over the desired length. We
        // end up overshooting the target length in doing this, but we're not looking to
        // be super accurate so we'll let the sanity trims do their job.
        const spreadFactor = Math.ceil(points / input.length);
        for (const val of input) {
            samples.push(...arraySeed(val, spreadFactor));
        }
    }

    // Trim to size & return
    return arrayTrimFill(samples, points, arraySeed(input[input.length - 1], points));
}

/**
 * Attempts a smooth resample of the given array. This is functionally similar to arrayFastResample
 * though can take longer due to the smoothing of data.
 * @param {number[]} input The input array to resample.
 * @param {number} points The number of samples to end up with.
 * @returns {number[]} The resampled array.
 */
// ts-prune-ignore-next
export function arraySmoothingResample(input: number[], points: number): number[] {
    if (input.length === points) return input; // short-circuit a complicated call

    let samples: number[] = [];
    if (input.length > points) {
        // We're downsampling. To preserve the curve we'll actually reduce our sample
        // selection and average some points between them.

        // All we're doing here is repeatedly averaging the waveform down to near our
        // target value. We don't average down to exactly our target as the loop might
        // never end, and we can over-average the data. Instead, we'll get as far as
        // we can and do a followup fast resample (the neighbouring points will be close
        // to the actual waveform, so we can get away with this safely).
        while (samples.length > points * 2 || samples.length === 0) {
            samples = [];
            for (let i = 1; i < input.length - 1; i += 2) {
                const prevPoint = input[i - 1];
                const nextPoint = input[i + 1];
                const currPoint = input[i];
                const average = (prevPoint + nextPoint + currPoint) / 3;
                samples.push(average);
            }
            input = samples;
        }

        return arrayFastResample(samples, points);
    } else {
        // In practice there's not much purpose in burning CPU for short arrays only to
        // end up with a result that can't possibly look much different than the fast
        // resample, so just skip ahead to the fast resample.
        return arrayFastResample(input, points);
    }
}

/**
 * Rescales the input array to have values that are inclusively within the provided
 * minimum and maximum.
 * @param {number[]} input The array to rescale.
 * @param {number} newMin The minimum value to scale to.
 * @param {number} newMax The maximum value to scale to.
 * @returns {number[]} The rescaled array.
 */
// ts-prune-ignore-next
export function arrayRescale(input: number[], newMin: number, newMax: number): number[] {
    const min: number = Math.min(...input);
    const max: number = Math.max(...input);
    return input.map((v) => percentageWithin(percentageOf(v, min, max), newMin, newMax));
}

/**
 * Creates an array of the given length, seeded with the given value.
 * @param {T} val The value to seed the array with.
 * @param {number} length The length of the array to create.
 * @returns {T[]} The array.
 */
export function arraySeed<T>(val: T, length: number): T[] {
    // Size the array up front for performance, and use `fill` to let the browser
    // optimize the operation better than we can with a `for` loop, if it wants.
    return new Array<T>(length).fill(val);
}

/**
 * Trims or fills the array to ensure it meets the desired length. The seed array
 * given is pulled from to fill any missing slots - it is recommended that this be
 * at least `len` long. The resulting array will be exactly `len` long, either
 * trimmed from the source or filled with the some/all of the seed array.
 * @param {T[]} a The array to trim/fill.
 * @param {number} len The length to trim or fill to, as needed.
 * @param {T[]} seed Values to pull from if the array needs filling.
 * @returns {T[]} The resulting array of `len` length.
 */
export function arrayTrimFill<T>(a: T[], len: number, seed: T[]): T[] {
    // Dev note: we do length checks because the spread operator can result in some
    // performance penalties in more critical code paths. As a utility, it should be
    // as fast as possible to not cause a problem for the call stack, no matter how
    // critical that stack is.
    if (a.length === len) return a;
    if (a.length > len) return a.slice(0, len);
    return a.concat(seed.slice(0, len - a.length));
}

/**
 * Clones an array as fast as possible, retaining references of the array's values.
 * @param a The array to clone. Must be defined.
 * @returns A copy of the array.
 */
export function arrayFastClone<T>(a: T[]): T[] {
    return a.slice(0, a.length);
}

/**
 * Determines if the two arrays are different either in length, contents,
 * or order of those contents.
 * @param a The first array. Must be defined.
 * @param b The second array. Must be defined.
 * @returns True if they are different, false otherwise.
 */
export function arrayHasOrderChange(a: any[], b: any[]): boolean {
    if (a.length === b.length) {
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return true;
        }
        return false;
    } else {
        return true; // like arrayHasDiff, a difference in length is a natural change
    }
}

/**
 * Determines if two arrays are different through a shallow comparison.
 * @param a The first array. Must be defined.
 * @param b The second array. Must be defined.
 * @returns True if they are different, false otherwise.
 */
export function arrayHasDiff(a: any[], b: any[]): boolean {
    if (a.length === b.length) {
        // When the lengths are equal, check to see if either array is missing
        // an element from the other.
        if (b.some((i) => !a.includes(i))) return true;
        if (a.some((i) => !b.includes(i))) return true;

        // if all the keys are common, say so
        return false;
    } else {
        return true; // different lengths means they are naturally diverged
    }
}

export type Diff<T> = { added: T[]; removed: T[] };

/**
 * Performs a diff on two arrays. The result is what is different with the
 * first array (`added` in the returned object means objects in B that aren't
 * in A). Shallow comparisons are used to perform the diff.
 * @param a The first array. Must be defined.
 * @param b The second array. Must be defined.
 * @returns The diff between the arrays.
 */
export function arrayDiff<T>(a: T[], b: T[]): Diff<T> {
    return {
        added: b.filter((i) => !a.includes(i)),
        removed: a.filter((i) => !b.includes(i)),
    };
}

/**
 * Returns the intersection of two arrays.
 * @param a The first array. Must be defined.
 * @param b The second array. Must be defined.
 * @returns The intersection of the arrays.
 */
export function arrayIntersection<T>(a: T[], b: T[]): T[] {
    return a.filter((i) => b.includes(i));
}

/**
 * Unions arrays, deduping contents using a Set.
 * @param a The arrays to merge.
 * @returns The union of all given arrays.
 */
export function arrayUnion<T>(...a: T[][]): T[] {
    return Array.from(
        a.reduce((c, v) => {
            v.forEach((i) => c.add(i));
            return c;
        }, new Set<T>()),
    );
}

/**
 * Moves a single element from fromIndex to toIndex.
 * @param {array} list the list from which to construct the new list.
 * @param {number} fromIndex the index of the element to move.
 * @param {number} toIndex the index of where to put the element.
 * @returns {array} A new array with the requested value moved.
 */
export function moveElement<T>(list: T[], fromIndex: number, toIndex: number): T[] {
    const result = Array.from(list);
    const [removed] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, removed);

    return result;
}

/**
 * Helper functions to perform LINQ-like queries on arrays.
 */
export class ArrayUtil<T> {
    /**
     * Create a new array helper.
     * @param a The array to help. Can be modified in-place.
     */
    public constructor(private a: T[]) {}

    /**
     * The value of this array, after all appropriate alterations.
     */
    public get value(): T[] {
        return this.a;
    }

    /**
     * Groups an array by keys.
     * @param fn The key-finding function.
     * @returns This.
     */
    public groupBy<K>(fn: (a: T) => K): GroupedArray<K, T> {
        const obj = this.a.reduce((rv: Map<K, T[]>, val: T) => {
            const k = fn(val);
            if (!rv.has(k)) rv.set(k, []);
            rv.get(k)!.push(val);
            return rv;
        }, new Map<K, T[]>());
        return new GroupedArray(obj);
    }
}

/**
 * Helper functions to perform LINQ-like queries on groups (maps).
 */
export class GroupedArray<K, T> {
    /**
     * Creates a new group helper.
     * @param val The group to help. Can be modified in-place.
     */
    public constructor(private val: Map<K, T[]>) {}

    /**
     * The value of this group, after all applicable alterations.
     */
    public get value(): Map<K, T[]> {
        return this.val;
    }

    /**
     * Orders the grouping into an array using the provided key order.
     * @param keyOrder The key order.
     * @returns An array helper of the result.
     */
    public orderBy(keyOrder: K[]): ArrayUtil<T> {
        const a: T[] = [];
        for (const k of keyOrder) {
            if (!this.val.has(k)) continue;
            a.push(...this.val.get(k)!);
        }
        return new ArrayUtil(a);
    }
}

export const concat = (...arrays: Uint8Array[]): Uint8Array => {
    return arrays.reduce((concatenatedSoFar: Uint8Array, toBeConcatenated: Uint8Array) => {
        const concatenated = new Uint8Array(concatenatedSoFar.length + toBeConcatenated.length);
        concatenated.set(concatenatedSoFar, 0);
        concatenated.set(toBeConcatenated, concatenatedSoFar.length);
        return concatenated;
    }, new Uint8Array(0));
};

/**
 * Async version of Array.every.
 */
export async function asyncEvery<T>(values: Iterable<T>, predicate: (value: T) => Promise<boolean>): Promise<boolean> {
    for (const value of values) {
        if (!(await predicate(value))) return false;
    }
    return true;
}

/**
 * Async version of Array.some.
 */
export async function asyncSome<T>(values: Iterable<T>, predicate: (value: T) => Promise<boolean>): Promise<boolean> {
    for (const value of values) {
        if (await predicate(value)) return true;
    }
    return false;
}

export function filterBoolean<T>(values: Array<T | null | undefined>): T[] {
    return values.filter(Boolean) as T[];
}

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

/**
 * Returns the default number if the given value, i, is not a number. Otherwise
 * returns the given value.
 * @param {*} i The value to check.
 * @param {number} def The default value.
 * @returns {number} Either the value or the default value, whichever is a number.
 */
export function defaultNumber(i: unknown, def: number): number {
    return Number.isFinite(i) ? Number(i) : def;
}

export function clamp(i: number, min: number, max: number): number {
    return Math.min(Math.max(i, min), max);
}

export function sum(...i: number[]): number {
    return [...i].reduce((p, c) => c + p, 0);
}

export function percentageWithin(pct: number, min: number, max: number): number {
    return pct * (max - min) + min;
}

export function percentageOf(val: number, min: number, max: number): number {
    const percentage = (val - min) / (max - min);
    return Number.isNaN(percentage) ? 0 : percentage;
}

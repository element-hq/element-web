/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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

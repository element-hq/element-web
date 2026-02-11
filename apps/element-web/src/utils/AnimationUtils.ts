/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { clamp } from "lodash";

/**
 * This method linearly interpolates between two points (start, end). This is
 * most commonly used to find a point some fraction of the way along a line
 * between two endpoints (e.g. to move an object gradually between those
 * points).
 * @param {number} start the starting point
 * @param {number} end the ending point
 * @param {number} amt the interpolant
 * @returns
 */
export function lerp(start: number, end: number, amt: number): number {
    amt = clamp(amt, 0, 1);
    return (1 - amt) * start + amt * end;
}

/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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

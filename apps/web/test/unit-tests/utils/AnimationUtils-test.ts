/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { lerp } from "../../../src/utils/AnimationUtils";

describe("lerp", () => {
    it("correctly interpolates", () => {
        expect(lerp(0, 100, 0.5)).toBe(50);
        expect(lerp(50, 100, 0.5)).toBe(75);
        expect(lerp(0, 1, 0.1)).toBe(0.1);
    });

    it("clamps the interpolant", () => {
        expect(lerp(0, 100, 50)).toBe(100);
        expect(lerp(0, 100, -50)).toBe(0);
    });

    it("handles negative numbers", () => {
        expect(lerp(-100, 0, 0.5)).toBe(-50);
        expect(lerp(100, -100, 0.5)).toBe(0);
    });
});

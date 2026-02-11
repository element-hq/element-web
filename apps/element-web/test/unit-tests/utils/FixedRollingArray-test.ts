/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { FixedRollingArray } from "../../../src/utils/FixedRollingArray";

describe("FixedRollingArray", () => {
    it("should seed the array with the given value", () => {
        const seed = "test";
        const width = 24;
        const array = new FixedRollingArray(width, seed);

        expect(array.value.length).toBe(width);
        expect(array.value.every((v) => v === seed)).toBe(true);
    });

    it("should insert at the correct end", () => {
        const seed = "test";
        const value = "changed";
        const width = 24;
        const array = new FixedRollingArray(width, seed);
        array.pushValue(value);

        expect(array.value.length).toBe(width);
        expect(array.value[0]).toBe(value);
    });

    it("should roll over", () => {
        const seed = -1;
        const width = 24;
        const array = new FixedRollingArray(width, seed);

        const maxValue = width * 2;
        const minValue = width; // because we're forcing a rollover
        for (let i = 0; i <= maxValue; i++) {
            array.pushValue(i);
        }

        expect(array.value.length).toBe(width);

        for (let i = 1; i < width; i++) {
            const current = array.value[i];
            const previous = array.value[i - 1];
            expect(previous - current).toBe(1);

            if (i === 1) {
                // eslint-disable-next-line jest/no-conditional-expect
                expect(previous).toBe(maxValue);
            } else if (i === width) {
                // eslint-disable-next-line jest/no-conditional-expect
                expect(current).toBe(minValue);
            }
        }
    });
});

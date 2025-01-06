/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { setHasDiff } from "../../../src/utils/sets";

describe("sets", () => {
    describe("setHasDiff", () => {
        it("should flag true on A length > B length", () => {
            const a = new Set([1, 2, 3, 4]);
            const b = new Set([1, 2, 3]);
            const result = setHasDiff(a, b);
            expect(result).toBe(true);
        });

        it("should flag true on A length < B length", () => {
            const a = new Set([1, 2, 3]);
            const b = new Set([1, 2, 3, 4]);
            const result = setHasDiff(a, b);
            expect(result).toBe(true);
        });

        it("should flag true on element differences", () => {
            const a = new Set([1, 2, 3]);
            const b = new Set([4, 5, 6]);
            const result = setHasDiff(a, b);
            expect(result).toBe(true);
        });

        it("should flag false if same but order different", () => {
            const a = new Set([1, 2, 3]);
            const b = new Set([3, 1, 2]);
            const result = setHasDiff(a, b);
            expect(result).toBe(false);
        });

        it("should flag false if same", () => {
            const a = new Set([1, 2, 3]);
            const b = new Set([1, 2, 3]);
            const result = setHasDiff(a, b);
            expect(result).toBe(false);
        });
    });
});

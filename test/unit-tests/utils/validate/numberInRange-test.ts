/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { validateNumberInRange } from "../../../../src/utils/validate";

describe("validateNumberInRange", () => {
    const min = 1;
    const max = 10;
    it("returns false when value is a not a number", () => {
        expect(validateNumberInRange(min, max)("test" as unknown as number)).toEqual(false);
    });
    it("returns false when value is undefined", () => {
        expect(validateNumberInRange(min, max)(undefined)).toEqual(false);
    });
    it("returns false when value is NaN", () => {
        expect(validateNumberInRange(min, max)(NaN)).toEqual(false);
    });
    it("returns true when value is equal to min", () => {
        expect(validateNumberInRange(min, max)(min)).toEqual(true);
    });
    it("returns true when value is equal to max", () => {
        expect(validateNumberInRange(min, max)(max)).toEqual(true);
    });
    it("returns true when value is an int in range", () => {
        expect(validateNumberInRange(min, max)(2)).toEqual(true);
    });
    it("returns true when value is a float in range", () => {
        expect(validateNumberInRange(min, max)(2.2)).toEqual(true);
    });
});

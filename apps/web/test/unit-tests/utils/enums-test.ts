/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { getEnumValues, isEnumValue } from "../../../src/utils/enums";

enum TestStringEnum {
    First = "__first__",
    Second = "__second__",
}

enum TestNumberEnum {
    FirstKey = 10,
    SecondKey = 20,
}

describe("enums", () => {
    describe("getEnumValues", () => {
        it("should work on string enums", () => {
            const result = getEnumValues(TestStringEnum);
            expect(result).toBeDefined();
            expect(result).toHaveLength(2);
            expect(result).toEqual(["__first__", "__second__"]);
        });

        it("should work on number enums", () => {
            const result = getEnumValues(TestNumberEnum);
            expect(result).toBeDefined();
            expect(result).toHaveLength(2);
            expect(result).toEqual([10, 20]);
        });
    });

    describe("isEnumValue", () => {
        it("should return true on values in a string enum", () => {
            const result = isEnumValue(TestStringEnum, "__first__");
            expect(result).toBe(true);
        });

        it("should return false on values not in a string enum", () => {
            const result = isEnumValue(TestStringEnum, "not a value");
            expect(result).toBe(false);
        });

        it("should return true on values in a number enum", () => {
            const result = isEnumValue(TestNumberEnum, 10);
            expect(result).toBe(true);
        });

        it("should return false on values not in a number enum", () => {
            const result = isEnumValue(TestStringEnum, 99);
            expect(result).toBe(false);
        });
    });
});

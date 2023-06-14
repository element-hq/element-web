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

import { getEnumValues, isEnumValue } from "../../src/utils/enums";

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

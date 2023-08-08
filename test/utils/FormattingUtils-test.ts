/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { formatCount, formatCountLong } from "../../src/utils/FormattingUtils";

jest.mock("../../src/dispatcher/dispatcher");

describe("FormattingUtils", () => {
    describe("formatCount", () => {
        it.each([
            { count: 999, expectedCount: "999" },
            { count: 9999, expectedCount: "10K" },
            { count: 99999, expectedCount: "100K" },
            { count: 999999, expectedCount: "1M" },
            { count: 9999999, expectedCount: "10M" },
            { count: 99999999, expectedCount: "100M" },
            { count: 999999999, expectedCount: "1B" },
            { count: 9999999999, expectedCount: "10B" },
        ])("formats $count as $expectedCount", ({ count, expectedCount }) => {
            expect(formatCount(count)).toBe(expectedCount);
        });
    });

    describe("formatCountLong", () => {
        it("formats numbers according to the locale", () => {
            expect(formatCountLong(1000)).toBe("1,000");
        });
    });
});

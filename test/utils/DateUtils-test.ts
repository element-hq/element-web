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

import { formatSeconds, formatRelativeTime } from "../../src/DateUtils";

describe("formatSeconds", () => {
    it("correctly formats time with hours", () => {
        expect(formatSeconds((60 * 60 * 3) + (60 * 31) + (55))).toBe("03:31:55");
        expect(formatSeconds((60 * 60 * 3) + (60 * 0) + (55))).toBe("03:00:55");
        expect(formatSeconds((60 * 60 * 3) + (60 * 31) + (0))).toBe("03:31:00");
    });

    it("correctly formats time without hours", () => {
        expect(formatSeconds((60 * 60 * 0) + (60 * 31) + (55))).toBe("31:55");
        expect(formatSeconds((60 * 60 * 0) + (60 * 0) + (55))).toBe("00:55");
        expect(formatSeconds((60 * 60 * 0) + (60 * 31) + (0))).toBe("31:00");
    });
});

describe("formatRelativeTime", () => {
    let dateSpy;
    beforeAll(() => {
        dateSpy = jest
            .spyOn(global.Date, 'now')
            // Tuesday, 2 November 2021 11:18:03 UTC
            .mockImplementation(() => 1635851883000);
    });

    afterAll(() => {
        dateSpy.mockRestore();
    });

    it("returns hour format for events created less than 24 hours ago", () => {
        const date = new Date(2021, 10, 2, 11, 1, 23, 0);
        expect(formatRelativeTime(date)).toBe("11:01");
    });

    it("honours the hour format setting", () => {
        const date = new Date(2021, 10, 2, 11, 1, 23, 0);
        expect(formatRelativeTime(date)).toBe("11:01");
        expect(formatRelativeTime(date, false)).toBe("11:01");
        expect(formatRelativeTime(date, true)).toBe("11:01AM");
    });

    it("returns month and day for events created in the current year", () => {
        const date = new Date(1632567741000);
        expect(formatRelativeTime(date, true)).toBe("Sep 25");
    });

    it("does not return a leading 0 for single digit days", () => {
        const date = new Date(1635764541000);
        expect(formatRelativeTime(date, true)).toBe("Nov 1");
    });

    it("appends the year for events created in previous years", () => {
        const date = new Date(1604142141000);
        expect(formatRelativeTime(date, true)).toBe("Oct 31, 2020");
    });
});

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

import {
    formatSeconds,
    formatRelativeTime,
    formatDuration,
    formatFullDateNoDayISO,
    formatDateForInput,
    formatTimeLeft,
    formatPreciseDuration,
    formatLocalDateShort,
} from "../../src/DateUtils";
import { REPEATABLE_DATE, mockIntlDateTimeFormat, unmockIntlDateTimeFormat } from "../test-utils";

describe("formatSeconds", () => {
    it("correctly formats time with hours", () => {
        expect(formatSeconds(60 * 60 * 3 + 60 * 31 + 55)).toBe("03:31:55");
        expect(formatSeconds(60 * 60 * 3 + 60 * 0 + 55)).toBe("03:00:55");
        expect(formatSeconds(60 * 60 * 3 + 60 * 31 + 0)).toBe("03:31:00");
        expect(formatSeconds(-(60 * 60 * 3 + 60 * 31 + 0))).toBe("-03:31:00");
    });

    it("correctly formats time without hours", () => {
        expect(formatSeconds(60 * 60 * 0 + 60 * 31 + 55)).toBe("31:55");
        expect(formatSeconds(60 * 60 * 0 + 60 * 0 + 55)).toBe("00:55");
        expect(formatSeconds(60 * 60 * 0 + 60 * 31 + 0)).toBe("31:00");
        expect(formatSeconds(-(60 * 60 * 0 + 60 * 31 + 0))).toBe("-31:00");
    });
});

describe("formatRelativeTime", () => {
    let dateSpy: jest.SpyInstance<number, []>;
    beforeAll(() => {
        dateSpy = jest
            .spyOn(global.Date, "now")
            // Tuesday, 2 November 2021 11:18:03 UTC
            .mockImplementation(() => 1635851883000);
    });

    afterAll(() => {
        dateSpy.mockRestore();
    });

    it("returns hour format for events created in the same day", () => {
        // Tuesday, 2 November 2021 11:01:00 UTC
        const date = new Date(2021, 10, 2, 11, 1, 23, 0);
        expect(formatRelativeTime(date)).toBe("11:01");
    });

    it("returns month and day for events created less than 24h ago but on a different day", () => {
        // Monday, 1 November 2021 23:01:00 UTC
        const date = new Date(2021, 10, 1, 23, 1, 23, 0);
        expect(formatRelativeTime(date)).toBe("Nov 1");
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

describe("formatDuration()", () => {
    type TestCase = [string, string, number];

    const MINUTE_MS = 60000;
    const HOUR_MS = MINUTE_MS * 60;

    it.each<TestCase>([
        ["rounds up to nearest day when more than 24h - 40 hours", "2d", 40 * HOUR_MS],
        ["rounds down to nearest day when more than 24h - 26 hours", "1d", 26 * HOUR_MS],
        ["24 hours", "1d", 24 * HOUR_MS],
        ["rounds to nearest hour when less than 24h - 23h", "23h", 23 * HOUR_MS],
        ["rounds to nearest hour when less than 24h - 6h and 10min", "6h", 6 * HOUR_MS + 10 * MINUTE_MS],
        ["rounds to nearest hours when less than 24h", "2h", 2 * HOUR_MS + 124234],
        ["rounds to nearest minute when less than 1h - 59 minutes", "59m", 59 * MINUTE_MS],
        ["rounds to nearest minute when less than 1h -  1 minute", "1m", MINUTE_MS],
        ["rounds to nearest second when less than 1min - 59 seconds", "59s", 59000],
        ["rounds to 0 seconds when less than a second - 123ms", "0s", 123],
    ])("%s formats to %s", (_description, expectedResult, input) => {
        expect(formatDuration(input)).toEqual(expectedResult);
    });
});

describe("formatPreciseDuration", () => {
    const MINUTE_MS = 1000 * 60;
    const HOUR_MS = MINUTE_MS * 60;
    const DAY_MS = HOUR_MS * 24;

    it.each<[string, string, number]>([
        ["3 days, 6 hours, 48 minutes, 59 seconds", "3d 6h 48m 59s", 3 * DAY_MS + 6 * HOUR_MS + 48 * MINUTE_MS + 59000],
        ["6 hours, 48 minutes, 59 seconds", "6h 48m 59s", 6 * HOUR_MS + 48 * MINUTE_MS + 59000],
        ["48 minutes, 59 seconds", "48m 59s", 48 * MINUTE_MS + 59000],
        ["59 seconds", "59s", 59000],
        ["0 seconds", "0s", 0],
    ])("%s formats to %s", (_description, expectedResult, input) => {
        expect(formatPreciseDuration(input)).toEqual(expectedResult);
    });
});

describe("formatFullDateNoDayISO", () => {
    it("should return ISO format", () => {
        expect(formatFullDateNoDayISO(REPEATABLE_DATE)).toEqual("2022-11-17T16:58:32.517Z");
    });
});

describe("formatDateForInput", () => {
    it.each([["1993-11-01"], ["1066-10-14"], ["0571-04-22"], ["0062-02-05"]])(
        "should format %s",
        (dateString: string) => {
            expect(formatDateForInput(new Date(dateString))).toBe(dateString);
        },
    );
});

describe("formatTimeLeft", () => {
    it.each([
        [0, "0s left"],
        [23, "23s left"],
        [60 + 23, "1m 23s left"],
        [60 * 60, "1h 0m 0s left"],
        [60 * 60 + 23, "1h 0m 23s left"],
        [5 * 60 * 60 + 7 * 60 + 23, "5h 7m 23s left"],
    ])("should format %s to %s", (seconds: number, expected: string) => {
        expect(formatTimeLeft(seconds)).toBe(expected);
    });
});

describe("formatLocalDateShort()", () => {
    afterAll(() => {
        unmockIntlDateTimeFormat();
    });
    const timestamp = new Date("Fri Dec 17 2021 09:09:00 GMT+0100 (Central European Standard Time)").getTime();
    it("formats date correctly by locale", () => {
        // format is DD/MM/YY
        mockIntlDateTimeFormat("en-UK");
        expect(formatLocalDateShort(timestamp)).toEqual("17/12/21");

        // US date format is MM/DD/YY
        mockIntlDateTimeFormat("en-US");
        expect(formatLocalDateShort(timestamp)).toEqual("12/17/21");

        mockIntlDateTimeFormat("de-DE");
        expect(formatLocalDateShort(timestamp)).toEqual("17.12.21");
    });
});

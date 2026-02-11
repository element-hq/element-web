/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
    getDaysArray,
    getMonthsArray,
    formatFullDateNoDayNoTime,
    formatTime,
    formatFullTime,
    formatFullDate,
    formatFullDateNoTime,
    formatDate,
    HOUR_MS,
    MINUTE_MS,
    DAY_MS,
} from "../../../src/DateUtils";
import { REPEATABLE_DATE, mockIntlDateTimeFormat, unmockIntlDateTimeFormat } from "../../test-utils";
import * as languageHandler from "../../../src/languageHandler";

describe("getDaysArray", () => {
    it("should return Sunday-Saturday in long mode", () => {
        expect(getDaysArray("long")).toMatchInlineSnapshot(`
            [
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ]
        `);
    });
    it("should return Sun-Sat in short mode", () => {
        expect(getDaysArray("short")).toMatchInlineSnapshot(`
            [
              "Sun",
              "Mon",
              "Tue",
              "Wed",
              "Thu",
              "Fri",
              "Sat",
            ]
        `);
    });
    it("should return S-S in narrow mode", () => {
        expect(getDaysArray("narrow")).toMatchInlineSnapshot(`
            [
              "S",
              "M",
              "T",
              "W",
              "T",
              "F",
              "S",
            ]
        `);
    });
});

describe("getMonthsArray", () => {
    it("should return January-December in long mode", () => {
        expect(getMonthsArray("long")).toMatchInlineSnapshot(`
            [
              "January",
              "February",
              "March",
              "April",
              "May",
              "June",
              "July",
              "August",
              "September",
              "October",
              "November",
              "December",
            ]
        `);
    });
    it("should return Jan-Dec in short mode", () => {
        expect(getMonthsArray("short")).toMatchInlineSnapshot(`
            [
              "Jan",
              "Feb",
              "Mar",
              "Apr",
              "May",
              "Jun",
              "Jul",
              "Aug",
              "Sep",
              "Oct",
              "Nov",
              "Dec",
            ]
        `);
    });
    it("should return J-D in narrow mode", () => {
        expect(getMonthsArray("narrow")).toMatchInlineSnapshot(`
            [
              "J",
              "F",
              "M",
              "A",
              "M",
              "J",
              "J",
              "A",
              "S",
              "O",
              "N",
              "D",
            ]
        `);
    });
    it("should return 1-12 in numeric mode", () => {
        expect(getMonthsArray("numeric")).toMatchInlineSnapshot(`
            [
              "1",
              "2",
              "3",
              "4",
              "5",
              "6",
              "7",
              "8",
              "9",
              "10",
              "11",
              "12",
            ]
        `);
    });
    it("should return 01-12 in 2-digit mode", () => {
        expect(getMonthsArray("2-digit")).toMatchInlineSnapshot(`
            [
              "01",
              "02",
              "03",
              "04",
              "05",
              "06",
              "07",
              "08",
              "09",
              "10",
              "11",
              "12",
            ]
        `);
    });
});

describe("formatDate", () => {
    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(REPEATABLE_DATE);
    });

    afterAll(() => {
        jest.setSystemTime(jest.getRealSystemTime());
        jest.useRealTimers();
    });

    it("should return time string if date is within same day", () => {
        const date = new Date(REPEATABLE_DATE.getTime() + 2 * HOUR_MS + 12 * MINUTE_MS);
        // We use en-US for these tests because there was a change in Node 22.12 which removed
        // the comma after the weekday for en-GB which makes the test output different things
        // on different node versions. I'm not sure what a better fix would be, so let's just use
        // a locale that happens to have a more stable formatting right now.
        expect(formatDate(date, false, "en-US")).toMatchInlineSnapshot(`"19:10"`);
    });

    it("should return time string with weekday if date is within last 6 days", () => {
        const date = new Date(REPEATABLE_DATE.getTime() - 6 * DAY_MS + 2 * HOUR_MS + 12 * MINUTE_MS);
        expect(formatDate(date, false, "en-US")).toMatchInlineSnapshot(`"Fri 19:10"`);
    });

    it("should return time & date string without year if it is within the same year", () => {
        const date = new Date(REPEATABLE_DATE.getTime() - 66 * DAY_MS + 2 * HOUR_MS + 12 * MINUTE_MS);
        expect(formatDate(date, false, "en-US")).toMatchInlineSnapshot(`"Mon, Sep 12, 19:10"`);
    });

    it("should return full time & date string otherwise", () => {
        const date = new Date(REPEATABLE_DATE.getTime() - 666 * DAY_MS + 2 * HOUR_MS + 12 * MINUTE_MS);
        expect(formatDate(date, false, "en-US")).toMatchInlineSnapshot(`"Wed, Jan 20, 2021, 19:10"`);
    });
});

describe("formatFullDateNoTime", () => {
    it("should match given locale en-GB", () => {
        expect(formatFullDateNoTime(REPEATABLE_DATE, "en-GB")).toMatchInlineSnapshot(`"Thu, 17 Nov 2022"`);
    });
});

describe("formatFullDate", () => {
    it("correctly formats with seconds", () => {
        expect(formatFullDate(REPEATABLE_DATE, true, true, "en-GB")).toMatchInlineSnapshot(
            `"Thu, 17 Nov 2022, 4:58:32 pm"`,
        );
    });
    it("correctly formats without seconds", () => {
        expect(formatFullDate(REPEATABLE_DATE, false, false, "en-GB")).toMatchInlineSnapshot(
            `"Thu, 17 Nov 2022, 16:58"`,
        );
    });
});

describe("formatFullTime", () => {
    it("correctly formats 12 hour mode", () => {
        expect(formatFullTime(REPEATABLE_DATE, true, "en-GB")).toMatchInlineSnapshot(`"4:58:32 pm"`);
    });
    it("correctly formats 24 hour mode", () => {
        expect(formatFullTime(REPEATABLE_DATE, false, "en-GB")).toMatchInlineSnapshot(`"16:58:32"`);
    });
});

describe("formatTime", () => {
    it("correctly formats 12 hour mode", () => {
        expect(formatTime(REPEATABLE_DATE, true, "en-GB")).toMatchInlineSnapshot(`"4:58 pm"`);
    });
    it("correctly formats 24 hour mode", () => {
        expect(formatTime(REPEATABLE_DATE, false, "en-GB")).toMatchInlineSnapshot(`"16:58"`);
    });
});

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
    beforeAll(() => {
        jest.useFakeTimers();
        // Tuesday, 2 November 2021 11:18:03 UTC
        jest.setSystemTime(1635851883000);
    });

    afterAll(() => {
        jest.setSystemTime(jest.getRealSystemTime());
        jest.useRealTimers();
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
        expect(formatRelativeTime(date, true)).toBe("11:01 AM");
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

describe("formatFullDateNoDayNoTime", () => {
    it("should return a date formatted for en-GB locale", () => {
        expect(formatFullDateNoDayNoTime(REPEATABLE_DATE, "en-GB")).toMatchInlineSnapshot(`"17/11/2022"`);
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
        const locale = jest.spyOn(languageHandler, "getUserLanguage");
        mockIntlDateTimeFormat();

        // format is DD/MM/YY
        locale.mockReturnValue("en-GB");
        expect(formatLocalDateShort(timestamp)).toEqual("17/12/21");

        // US date format is MM/DD/YY
        locale.mockReturnValue("en-US");
        expect(formatLocalDateShort(timestamp)).toEqual("12/17/21");

        locale.mockReturnValue("de-DE");
        expect(formatLocalDateShort(timestamp)).toEqual("17.12.21");
    });
});

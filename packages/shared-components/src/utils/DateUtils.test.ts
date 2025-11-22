/*
 * Copyright 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { DAY_MS, getDaysArray, formatFullDateNoTime, formatSeconds } from "./DateUtils";

describe("DateUtils", () => {
    describe("DAY_MS", () => {
        it("should equal the number of milliseconds in a day", () => {
            expect(DAY_MS).toBe(24 * 60 * 60 * 1000);
            expect(DAY_MS).toBe(86400000);
        });
    });

    describe("getDaysArray", () => {
        it("should return 7 days starting with Sunday", () => {
            const days = getDaysArray("short", "en");
            expect(days).toHaveLength(7);
            expect(days[0]).toBe("Sun");
            expect(days[1]).toBe("Mon");
            expect(days[6]).toBe("Sat");
        });

        it("should use short format by default", () => {
            const days = getDaysArray(undefined, "en");
            expect(days).toHaveLength(7);
            expect(days[0]).toBe("Sun");
        });

        it("should use en locale by default", () => {
            const days = getDaysArray("short");
            expect(days).toHaveLength(7);
            expect(days[0]).toBe("Sun");
        });

        it("should support long weekday format", () => {
            const days = getDaysArray("long", "en");
            expect(days).toHaveLength(7);
            expect(days[0]).toBe("Sunday");
            expect(days[1]).toBe("Monday");
            expect(days[6]).toBe("Saturday");
        });

        it("should support narrow weekday format", () => {
            const days = getDaysArray("narrow", "en");
            expect(days).toHaveLength(7);
            expect(days[0]).toBe("S");
            expect(days[1]).toBe("M");
        });

        it("should support different locales", () => {
            const daysFr = getDaysArray("long", "fr");
            expect(daysFr).toHaveLength(7);
            expect(daysFr[0]).toBe("dimanche");
            expect(daysFr[1]).toBe("lundi");
        });
    });

    describe("formatFullDateNoTime", () => {
        it("should format date with short weekday, month, day and year", () => {
            const date = new Date("2022-11-17T12:00:00Z");
            const formatted = formatFullDateNoTime(date, "en-GB");
            expect(formatted).toContain("Nov");
            expect(formatted).toContain("17");
            expect(formatted).toContain("2022");
        });

        it("should use en locale by default", () => {
            const date = new Date("2022-11-17T12:00:00Z");
            const formatted = formatFullDateNoTime(date);
            expect(formatted).toContain("Nov");
            expect(formatted).toContain("17");
            expect(formatted).toContain("2022");
        });

        it("should format dates in different locales", () => {
            const date = new Date("2022-11-17T12:00:00Z");
            const formattedFr = formatFullDateNoTime(date, "fr");
            expect(formattedFr).toContain("nov.");
            expect(formattedFr).toContain("17");
            expect(formattedFr).toContain("2022");
        });
    });

    describe("formatSeconds", () => {
        it("should format seconds only", () => {
            expect(formatSeconds(45)).toBe("00:45");
        });

        it("should format minutes and seconds", () => {
            expect(formatSeconds(125)).toBe("02:05");
        });

        it("should format hours, minutes and seconds", () => {
            expect(formatSeconds(3665)).toBe("01:01:05");
        });

        it("should pad with zeros", () => {
            expect(formatSeconds(5)).toBe("00:05");
            expect(formatSeconds(65)).toBe("01:05");
        });

        it("should handle zero", () => {
            expect(formatSeconds(0)).toBe("00:00");
        });

        it("should handle negative numbers", () => {
            expect(formatSeconds(-45)).toBe("-00:45");
            expect(formatSeconds(-125)).toBe("-02:05");
            expect(formatSeconds(-3665)).toBe("-01:01:05");
        });

        it("should handle large durations", () => {
            expect(formatSeconds(36000)).toBe("10:00:00");
            expect(formatSeconds(359999)).toBe("99:59:59");
        });

        it("should handle fractional seconds by flooring", () => {
            expect(formatSeconds(45.9)).toBe("00:45");
            expect(formatSeconds(125.5)).toBe("02:05");
        });
    });
});

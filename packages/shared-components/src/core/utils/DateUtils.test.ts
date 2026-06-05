/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { describe, it, expect } from "vitest";

import { formatSeconds, formatDateForInput } from "./DateUtils";

function makeDate(year: number, month: number, day: number): Date {
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
}

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

describe("formatDateForInput", () => {
    it.each([
        ["1993-11-01", makeDate(1993, 11, 1)],
        ["1066-10-14", makeDate(1066, 10, 14)],
        ["0571-04-22", makeDate(571, 4, 22)],
        ["0062-02-05", makeDate(62, 2, 5)],
    ])("should format %s", (dateString: string, date: Date) => {
        expect(formatDateForInput(date)).toBe(dateString);
    });
});

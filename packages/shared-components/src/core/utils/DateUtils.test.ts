/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { describe, it, expect } from "vitest";

import { formatSeconds, formatDateForInput } from "./DateUtils";

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
    it.each([["1993-11-01"], ["1066-10-14"], ["0571-04-22"], ["0062-02-05"]])(
        "should format %s",
        (dateString: string) => {
            expect(formatDateForInput(new Date(dateString))).toBe(dateString);
        },
    );
});

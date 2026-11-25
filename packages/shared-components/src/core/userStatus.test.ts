/*
Copyright 2026 Mohd Quamar Tyagi

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { limitUserStatusInputText } from "./userStatus";

describe("limitUserStatusInputText", () => {
    const family = "👨‍👩‍👧‍👦";
    const grin = "😀";

    it("keeps 30 ASCII characters and drops a 31st", () => {
        expect(limitUserStatusInputText("a".repeat(30))).toBe("a".repeat(30));
        expect(limitUserStatusInputText("a".repeat(31))).toBe("a".repeat(30));
    });

    it("counts a family emoji as one character at the 30-character boundary", () => {
        expect(family.length).toBeGreaterThan(2);
        expect(limitUserStatusInputText(`${"a".repeat(29)}${family}`)).toBe(`${"a".repeat(29)}${family}`);
        expect(limitUserStatusInputText(`${"a".repeat(29)}${family}x`)).toBe(`${"a".repeat(29)}${family}`);
    });

    it("counts grinning emoji as one character each", () => {
        expect(grin).toHaveLength(2);
        expect(limitUserStatusInputText(grin.repeat(30))).toBe(grin.repeat(30));
        expect(limitUserStatusInputText(grin.repeat(31))).toBe(grin.repeat(30));
    });

    it("does not split family emoji when the 256-byte protocol cap is tighter than 30 graphemes", () => {
        // Each family emoji is 25 UTF-8 bytes, so 10 fit in 256 bytes and 11 do not.
        expect(limitUserStatusInputText(family.repeat(30))).toBe(family.repeat(10));
        expect(new TextEncoder().encode(family.repeat(10)).length).toBeLessThanOrEqual(256);
        expect(new TextEncoder().encode(family.repeat(11)).length).toBeGreaterThan(256);
    });
});

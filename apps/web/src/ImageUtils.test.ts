/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { describe, expect, it } from "vitest";

import { thumbHeight, thumbSize } from "./ImageUtils";

describe("ImageUtils", () => {
    describe("thumbSize", () => {
        it.each([
            [1200, 600, { width: 478, height: 239 }], // wide: limited by the box width
            [500, 1000, { width: 239, height: 478 }], // tall: limited by the box height
            [478, 478, { width: 478, height: 478 }], // exactly the box
            [128, 128, { width: 128, height: 128 }], // smaller than the box: not scaled up
        ])("fits a %ix%i image into a 478x478 box as %o", (width, height, expected) => {
            expect(thumbSize(width, height, 478, 478)).toEqual(expected);
        });

        it("returns null when a dimension is unknown", () => {
            expect(thumbSize(undefined, 100, 478, 478)).toBeNull();
            expect(thumbSize(100, 0, 478, 478)).toBeNull();
        });
    });

    describe("thumbHeight", () => {
        it("returns the height of the fitted image", () => {
            expect(thumbHeight(1200, 600, 478, 478)).toBe(239);
            expect(thumbHeight(500, 1000, 478, 478)).toBe(478);
            expect(thumbHeight(128, 128, 478, 478)).toBe(128);
        });

        it("returns null when a dimension is unknown", () => {
            expect(thumbHeight(undefined, 100, 478, 478)).toBeNull();
        });
    });
});

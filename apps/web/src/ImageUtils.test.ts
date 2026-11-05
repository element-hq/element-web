/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { describe, expect, it } from "vitest";

import { thumbHeight } from "./ImageUtils";

describe("thumbHeight", () => {
    it.each([
        [1200, 600, 239], // wide: limited by the box width
        [500, 1000, 478], // tall: limited by the box height
        [478, 478, 478], // exactly the box
        [128, 128, 128], // smaller than the box: not scaled up
    ])("fits a %ix%i image into a 478x478 box at a height of %i", (width, height, expected) => {
        expect(thumbHeight(width, height, 478, 478)).toBe(expected);
    });

    it("returns null when a dimension is unknown", () => {
        expect(thumbHeight(undefined, 100, 478, 478)).toBeNull();
        expect(thumbHeight(100, 0, 478, 478)).toBeNull();
    });
});

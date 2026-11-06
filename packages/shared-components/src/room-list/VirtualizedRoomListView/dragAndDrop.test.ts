/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { describe, it, expect } from "vitest";

import { canDropForReorder, getDropPosition } from "./dragAndDrop";

describe("canDropForReorder", () => {
    it("accepts a room that can be reordered", () => {
        expect(canDropForReorder({ type: "room", isDm: false, index: 0, canReorder: true })).toBe(true);
    });

    it.each([
        ["a room that can't be reordered", { type: "room" as const, isDm: false, index: 0, canReorder: false }],
        ["a section", { type: "section" as const, index: 0 }],
        ["nothing", undefined],
    ])("refuses %s", (_, dragged) => {
        expect(canDropForReorder(dragged)).toBe(false);
    });
});

describe("getDropPosition", () => {
    it("places a room dragged upwards before the target", () => {
        expect(getDropPosition(4, 1)).toBe("before");
    });

    it("places a room dragged downwards after the target", () => {
        expect(getDropPosition(1, 4)).toBe("after");
    });
});

/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from "vitest";

import { toRightOf } from "./ContextMenu";
import UIStore from "../../stores/UIStore";

describe("ContextMenu", () => {
    const rect = {
        left: 23,
        right: 46,
        top: 42,
        width: 640,
        height: 480,
    } as DOMRect;

    beforeEach(() => {
        window.scrollX = 31;
        window.scrollY = 41;
        UIStore.instance.windowWidth = 1280;
    });

    describe("toRightOf", () => {
        it("should return the correct positioning", () => {
            expect(toRightOf(rect)).toEqual({
                chevronOffset: 12,
                left: 80, // 46 + 31 + 3
                top: 303, // 42 + (480 / 2) + 41 - (12 + 8)
            });
        });
    });
});

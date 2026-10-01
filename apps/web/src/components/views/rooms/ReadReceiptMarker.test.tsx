/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "test-utils-rtl";

import ReadReceiptMarker, { type IReadReceiptPosition } from "./ReadReceiptMarker";

describe("ReadReceiptMarker", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it("should position at -16px if given no previous position", () => {
        render(<ReadReceiptMarker fallbackUserId="bob" offset={0} />);

        expect(screen.getByTestId("avatar-img").style.top).toBe("-16px");
    });

    it("should position at previous top if given", () => {
        render(<ReadReceiptMarker fallbackUserId="bob" offset={0} readReceiptPosition={{ top: 100, right: 0 }} />);

        expect(screen.getByTestId("avatar-img").style.top).toBe("100px");
    });

    it("should apply new styles after mounted to animate", () => {
        vi.useFakeTimers();

        render(<ReadReceiptMarker fallbackUserId="bob" offset={0} readReceiptPosition={{ top: 100, right: 0 }} />);
        expect(screen.getByTestId("avatar-img").style.top).toBe("100px");

        vi.runAllTimers();

        expect(screen.getByTestId("avatar-img").style.top).toBe("0px");
    });

    it("should update readReceiptPosition when unmounted", () => {
        const pos: IReadReceiptPosition = {};
        const { unmount } = render(<ReadReceiptMarker fallbackUserId="bob" offset={0} readReceiptPosition={pos} />);

        expect(pos.top).toBeUndefined();

        unmount();

        expect(pos.top).toBe(0);
    });

    it("should update readReceiptPosition to current position", () => {
        const pos: IReadReceiptPosition = {};
        Object.defineProperty(HTMLElement.prototype, "offsetParent", {
            configurable: true,
            get(): Element | null {
                return {
                    getBoundingClientRect: vi.fn().mockReturnValue({ top: 0, right: 0 } as DOMRect),
                } as unknown as Element;
            },
        });
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 100, right: 0 } as DOMRect);

        const { unmount } = render(<ReadReceiptMarker fallbackUserId="bob" offset={0} readReceiptPosition={pos} />);

        expect(pos.top).toBeUndefined();

        unmount();

        expect(pos.top).toBe(100);
    });
});

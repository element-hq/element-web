/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";

import ReadReceiptMarker, {
    type IReadReceiptPosition,
} from "../../../../../src/components/views/rooms/ReadReceiptMarker";

describe("ReadReceiptMarker", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
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
        jest.useFakeTimers();

        render(<ReadReceiptMarker fallbackUserId="bob" offset={0} readReceiptPosition={{ top: 100, right: 0 }} />);
        expect(screen.getByTestId("avatar-img").style.top).toBe("100px");

        jest.runAllTimers();

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
        jest.spyOn(HTMLElement.prototype, "offsetParent", "get").mockImplementation(function (): Element | null {
            return {
                getBoundingClientRect: jest.fn().mockReturnValue({ top: 0, right: 0 } as DOMRect),
            } as unknown as Element;
        });
        jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 100, right: 0 } as DOMRect);

        const { unmount } = render(<ReadReceiptMarker fallbackUserId="bob" offset={0} readReceiptPosition={pos} />);

        expect(pos.top).toBeUndefined();

        unmount();

        expect(pos.top).toBe(100);
    });
});

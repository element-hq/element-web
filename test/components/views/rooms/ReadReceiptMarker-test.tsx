/*
Copyright 2024 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { render, screen } from "@testing-library/react";

import ReadReceiptMarker, { IReadReceiptPosition } from "../../../../src/components/views/rooms/ReadReceiptMarker";

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

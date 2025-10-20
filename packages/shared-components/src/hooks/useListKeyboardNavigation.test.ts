/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type KeyboardEvent } from "react";
import { renderHook } from "jest-matrix-react";

import { useListKeyboardNavigation } from "./useListKeyboardNavigation";

describe("useListKeyDown", () => {
    let mockList: HTMLUListElement;
    let mockItems: HTMLElement[];
    let mockEvent: Partial<KeyboardEvent<HTMLUListElement>>;

    beforeEach(() => {
        // Create mock DOM elements
        mockList = document.createElement("ul");
        mockItems = [document.createElement("li"), document.createElement("li"), document.createElement("li")];

        // Set up the DOM structure
        mockItems.forEach((item, index) => {
            item.setAttribute("tabindex", "0");
            item.setAttribute("data-testid", `item-${index}`);
            mockList.appendChild(item);
        });

        document.body.appendChild(mockList);

        // Mock event object
        mockEvent = {
            preventDefault: jest.fn(),
            key: "",
        };

        // Mock focus methods
        mockItems.forEach((item) => {
            item.focus = jest.fn();
            item.click = jest.fn();
        });
    });

    afterEach(() => {
        document.body.removeChild(mockList);
        jest.clearAllMocks();
    });

    function render(): {
        current: {
            listRef: React.RefObject<HTMLUListElement | null>;
            onKeyDown: React.KeyboardEventHandler<HTMLUListElement>;
            onFocus: React.FocusEventHandler<HTMLUListElement>;
        };
    } {
        const { result } = renderHook(() => useListKeyboardNavigation());
        result.current.listRef.current = mockList;
        return result;
    }

    it.each([
        ["Enter", "Enter"],
        ["Space", " "],
    ])("should handle %s key to click active element", (name, key) => {
        const result = render();

        // Mock document.activeElement
        Object.defineProperty(document, "activeElement", {
            value: mockItems[1],
            configurable: true,
        });

        // Simulate key press
        result.current.onKeyDown({
            ...mockEvent,
            key,
        } as KeyboardEvent<HTMLUListElement>);

        expect(mockItems[1].click).toHaveBeenCalledTimes(1);
        expect(mockEvent.preventDefault).toHaveBeenCalledTimes(1);
    });

    it.each(
        // key, finalPosition, startPosition
        [
            ["ArrowDown", 1, 0],
            ["ArrowUp", 1, 2],
            ["Home", 0, 1],
            ["End", 2, 1],
        ],
    )("should handle %s to focus the %inth element", (key, finalPosition, startPosition) => {
        const result = render();
        mockList.contains = jest.fn().mockReturnValue(true);

        Object.defineProperty(document, "activeElement", {
            value: mockItems[startPosition],
            configurable: true,
        });

        result.current.onKeyDown({
            ...mockEvent,
            key,
        } as KeyboardEvent<HTMLUListElement>);

        expect(mockItems[finalPosition].focus).toHaveBeenCalledTimes(1);
        expect(mockEvent.preventDefault).toHaveBeenCalledTimes(1);
    });

    it.each([["ArrowDown"], ["ArrowUp"]])("should not handle %s when active element is not in list", (key) => {
        const result = render();
        mockList.contains = jest.fn().mockReturnValue(false);

        const outsideElement = document.createElement("button");

        Object.defineProperty(document, "activeElement", {
            value: outsideElement,
            configurable: true,
        });

        result.current.onKeyDown({
            ...mockEvent,
            key,
        } as KeyboardEvent<HTMLUListElement>);

        // No item should be focused
        mockItems.forEach((item) => expect(item.focus).not.toHaveBeenCalled());
        expect(mockEvent.preventDefault).toHaveBeenCalledTimes(1);
    });

    it("should not prevent default for unhandled keys", () => {
        const result = render();

        result.current.onKeyDown({
            ...mockEvent,
            key: "Tab",
        } as KeyboardEvent<HTMLUListElement>);

        expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it("should focus the first item if list itself is focused", () => {
        const result = render();
        result.current.onFocus({ target: mockList } as React.FocusEvent<HTMLUListElement>);
        expect(mockItems[0].focus).toHaveBeenCalledTimes(1);
    });

    it("should focus the selected item if list itself is focused", () => {
        mockItems[1].setAttribute("aria-selected", "true");
        const result = render();

        result.current.onFocus({ target: mockList } as React.FocusEvent<HTMLUListElement>);
        expect(mockItems[1].focus).toHaveBeenCalledTimes(1);
    });
});

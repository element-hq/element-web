/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import { render, waitFor, act } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import EmojiPicker from "../../../../../src/components/views/emojipicker/EmojiPicker";
import { stubClient } from "../../../../test-utils";
import SettingsStore from "../../../../../src/settings/SettingsStore";

describe("EmojiPicker", function () {
    stubClient();

    // Helper to get the currently active emoji's text content from the grid
    const getActiveEmojiText = (container: HTMLElement): string =>
        container.querySelector('.mx_EmojiPicker_body .mx_EmojiPicker_item_wrapper [tabindex="0"]')?.textContent || "";

    beforeEach(() => {
        // Clear recent emojis to prevent test pollution
        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => {
            if (settingName === "recent_emoji") return [] as any;
            return jest.requireActual("../../../../../src/settings/SettingsStore").default.getValue(settingName);
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should not mangle default order after filtering", async () => {
        const ref = createRef<EmojiPicker>();
        const { container } = render(
            <EmojiPicker ref={ref} onChoose={(str: string) => false} onFinished={jest.fn()} />,
        );

        // Record the HTML before filtering
        const beforeHtml = container.innerHTML;

        // Apply a filter and assert that the HTML has changed
        //@ts-ignore private access
        act(() => ref.current!.onChangeFilter("test"));
        expect(beforeHtml).not.toEqual(container.innerHTML);

        // Clear the filter and assert that the HTML matches what it was before filtering
        //@ts-ignore private access
        act(() => ref.current!.onChangeFilter(""));
        await waitFor(() => expect(beforeHtml).toEqual(container.innerHTML));
    });

    it("sort emojis by shortcode and size", function () {
        const ep = new EmojiPicker({ onChoose: (str: string) => false, onFinished: jest.fn() });

        //@ts-ignore private access
        act(() => ep.onChangeFilter("heart"));

        //@ts-ignore private access
        expect(ep.memoizedDataByCategory["people"][0].shortcodes[0]).toEqual("heart");
        //@ts-ignore private access
        expect(ep.memoizedDataByCategory["people"][1].shortcodes[0]).toEqual("heartbeat");
    });

    it("should allow keyboard navigation using arrow keys", async () => {
        // mock offsetParent
        Object.defineProperty(HTMLElement.prototype, "offsetParent", {
            get() {
                return this.parentNode;
            },
        });

        const onChoose = jest.fn();
        const onFinished = jest.fn();
        const { container } = render(<EmojiPicker onChoose={onChoose} onFinished={onFinished} />);

        const input = container.querySelector("input")!;
        expect(input).toHaveFocus();

        function getEmoji(): string {
            return getActiveEmojiText(container);
        }

        expect(getEmoji()).toEqual("😀");
        // First arrow key press shows highlight without navigating
        await userEvent.keyboard("[ArrowDown]");
        expect(getEmoji()).toEqual("😀");
        // Subsequent arrow keys navigate
        await userEvent.keyboard("[ArrowDown]");
        expect(getEmoji()).toEqual("🙂");
        await userEvent.keyboard("[ArrowUp]");
        expect(getEmoji()).toEqual("😀");
        await userEvent.keyboard("Flag");
        await userEvent.keyboard("[ArrowRight]");
        await userEvent.keyboard("[ArrowRight]");
        expect(getEmoji()).toEqual("📫️");
        await userEvent.keyboard("[ArrowDown]");
        expect(getEmoji()).toEqual("🇦🇨");
        await userEvent.keyboard("[ArrowLeft]");
        expect(getEmoji()).toEqual("📭️");
        await userEvent.keyboard("[ArrowUp]");
        expect(getEmoji()).toEqual("⛳️");
        await userEvent.keyboard("[ArrowRight]");
        expect(getEmoji()).toEqual("📫️");
        await userEvent.keyboard("[Enter]");

        expect(onChoose).toHaveBeenCalledWith("📫️");
        expect(onFinished).toHaveBeenCalled();
    });

    it("should move actual focus when navigating between emojis after Tab", async () => {
        // mock offsetParent
        Object.defineProperty(HTMLElement.prototype, "offsetParent", {
            get() {
                return this.parentNode;
            },
        });

        const onChoose = jest.fn();
        const onFinished = jest.fn();
        const { container } = render(<EmojiPicker onChoose={onChoose} onFinished={onFinished} />);

        const input = container.querySelector("input")!;
        expect(input).toHaveFocus();

        // Wait for emojis to render
        await waitFor(() => {
            expect(container.querySelector('[role="gridcell"]')).toBeInTheDocument();
        });

        function getEmoji(): string {
            return document.activeElement?.textContent || "";
        }

        function getVirtuallyFocusedEmoji(): string {
            return getActiveEmojiText(container);
        }

        // Initially, arrow keys use virtual focus (aria-activedescendant)
        // The first emoji is virtually focused by default
        expect(input).toHaveFocus();
        expect(getVirtuallyFocusedEmoji()).toEqual("😀");
        expect(getEmoji()).toEqual(""); // No actual emoji has focus

        // First arrow key press shows highlight without navigating
        await userEvent.keyboard("[ArrowDown]");
        expect(input).toHaveFocus(); // Input still has focus
        expect(getVirtuallyFocusedEmoji()).toEqual("😀"); // Virtual focus stayed on first emoji
        expect(getEmoji()).toEqual(""); // No actual emoji has focus

        // Second arrow key press navigates
        await userEvent.keyboard("[ArrowDown]");
        expect(input).toHaveFocus(); // Input still has focus
        expect(getVirtuallyFocusedEmoji()).toEqual("🙂"); // Virtual focus moved
        expect(getEmoji()).toEqual(""); // No actual emoji has focus

        // Tab to move actual focus to the emoji
        await userEvent.keyboard("[Tab]");
        expect(input).not.toHaveFocus();
        expect(getEmoji()).toEqual("🙂"); // Now emoji has actual focus

        // Arrow keys now move actual DOM focus between emojis
        await userEvent.keyboard("[ArrowDown]");
        expect(getEmoji()).toEqual("🤩"); // Actual focus moved down one row
        expect(input).not.toHaveFocus();

        await userEvent.keyboard("[ArrowUp]");
        expect(getEmoji()).toEqual("🙂"); // Actual focus moved back up
        expect(input).not.toHaveFocus();

        await userEvent.keyboard("[ArrowRight]");
        expect(getEmoji()).toEqual("🙃"); // Actual focus moved right
        expect(input).not.toHaveFocus();
    });

    it("should not select emoji on Enter press before highlight is shown", async () => {
        // mock offsetParent
        Object.defineProperty(HTMLElement.prototype, "offsetParent", {
            get() {
                return this.parentNode;
            },
        });

        const onChoose = jest.fn();
        const onFinished = jest.fn();
        const { container } = render(<EmojiPicker onChoose={onChoose} onFinished={onFinished} />);

        const input = container.querySelector("input")!;
        expect(input).toHaveFocus();

        // Wait for emojis to render
        await waitFor(() => {
            expect(container.querySelector('[role="gridcell"]')).toBeInTheDocument();
        });

        // Press Enter immediately without interacting with arrow keys or search
        await userEvent.keyboard("[Enter]");

        // onChoose and onFinished should not be called
        expect(onChoose).not.toHaveBeenCalled();
        expect(onFinished).not.toHaveBeenCalled();

        // Now press arrow key to show highlight
        await userEvent.keyboard("[ArrowDown]");

        // Press Enter again - now it should work
        await userEvent.keyboard("[Enter]");

        // onChoose and onFinished should be called
        expect(onChoose).toHaveBeenCalledWith("😀");
        expect(onFinished).toHaveBeenCalled();
    });

    it("should reset to first emoji when filter is cleared after navigation", async () => {
        // mock offsetParent
        Object.defineProperty(HTMLElement.prototype, "offsetParent", {
            get() {
                return this.parentNode;
            },
        });

        const onChoose = jest.fn();
        const onFinished = jest.fn();
        const { container } = render(<EmojiPicker onChoose={onChoose} onFinished={onFinished} />);

        const input = container.querySelector("input")!;
        expect(input).toHaveFocus();

        function getEmoji(): string {
            return getActiveEmojiText(container);
        }

        // Initially on first emoji
        expect(getEmoji()).toEqual("😀");

        // Show highlight with first arrow press
        await userEvent.keyboard("[ArrowDown]");
        expect(getEmoji()).toEqual("😀");

        // Navigate to a different emoji
        await userEvent.keyboard("[ArrowDown]");
        expect(getEmoji()).toEqual("🙂");
        await userEvent.keyboard("[ArrowDown]");
        expect(getEmoji()).toEqual("🤩");

        // Type a search query to filter emojis (this sets showHighlight=true)
        await userEvent.type(input, "think");
        await waitFor(() => {
            // After filtering, we should be on the "thinking" emoji
            expect(getEmoji()).toEqual("🤔");
        });

        // Clear the search filter
        await userEvent.clear(input);

        // After clearing, showHighlight is false, so the highlight is hidden
        // The activeNode might still be on 🤔, but we can't see it

        // Press arrow key - this should reset to first emoji AND show highlight
        await userEvent.keyboard("[ArrowDown]");
        await waitFor(() => {
            expect(getEmoji()).toEqual("😀"); // Should now be on first emoji with highlight shown
        });

        // Next arrow key should navigate from first emoji
        await userEvent.keyboard("[ArrowDown]");
        expect(getEmoji()).toEqual("🙂");
    });
});

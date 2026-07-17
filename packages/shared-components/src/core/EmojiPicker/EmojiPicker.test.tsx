/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2023 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { createRef } from "react";
import userEvent from "@testing-library/user-event";
import { act, render, waitFor } from "@test-utils";
import { describe, expect, it, vi } from "vitest";

import { EmojiPicker } from "./EmojiPicker";

describe("EmojiPicker", function () {
    // Recent emojis as they would be provided by the app, most used first
    const RECENT_EMOJIS = ["😀", "🎉", "❤️"];

    // Helper to get the currently active emoji's text content from the grid
    const getActiveEmojiText = (container: HTMLElement): string =>
        container.querySelector('.mx_EmojiPicker_body .mx_EmojiPicker_item_wrapper [tabindex="0"]')?.textContent || "";

    it("should initialize categories with correct state when no recent emojis", () => {
        const ref = createRef<EmojiPicker>();
        render(<EmojiPicker ref={ref} onChoose={(str: string) => false} onFinished={vi.fn()} />);

        //@ts-ignore private access
        const categories = ref.current!.categories;

        // Verify we have all expected categories
        expect(categories).toHaveLength(9);
        expect(categories.map((c) => c.id)).toEqual([
            "recent",
            "people",
            "nature",
            "foods",
            "activity",
            "places",
            "objects",
            "symbols",
            "flags",
        ]);

        // Recent category should be disabled when empty
        const recentCategory = categories.find((c) => c.id === "recent");
        expect(recentCategory).toMatchObject({
            id: "recent",
            enabled: false,
            visible: false,
            firstVisible: false,
        });

        // People category should be the first visible when no recent emojis
        const peopleCategory = categories.find((c) => c.id === "people");
        expect(peopleCategory).toMatchObject({
            id: "people",
            enabled: true,
            visible: true,
            firstVisible: true,
        });

        // Other categories should start as not visible and not firstVisible
        const natureCategory = categories.find((c) => c.id === "nature");
        expect(natureCategory).toMatchObject({
            id: "nature",
            enabled: true,
            visible: false,
            firstVisible: false,
        });

        const flagsCategory = categories.find((c) => c.id === "flags");
        expect(flagsCategory).toMatchObject({
            id: "flags",
            enabled: true,
            visible: false,
            firstVisible: false,
        });

        // All categories should have refs and names
        categories.forEach((cat) => {
            expect(cat.ref).toBeTruthy();
            expect(cat.name).toBeTruthy();
        });
    });

    it("should initialize categories with recent as firstVisible when recent emojis exist", () => {
        const ref = createRef<EmojiPicker>();
        render(
            <EmojiPicker
                ref={ref}
                recentEmojis={RECENT_EMOJIS}
                onChoose={(str: string) => false}
                onFinished={vi.fn()}
            />,
        );

        //@ts-ignore private access
        const categories = ref.current!.categories;

        // Recent category should be enabled and firstVisible
        const recentCategory = categories.find((c) => c.id === "recent");
        expect(recentCategory).toMatchObject({
            id: "recent",
            enabled: true,
            visible: true,
            firstVisible: true,
        });

        // People category should be visible but NOT firstVisible when recent exists
        const peopleCategory = categories.find((c) => c.id === "people");
        expect(peopleCategory).toMatchObject({
            id: "people",
            enabled: true,
            visible: true,
            firstVisible: false,
        });
    });

    it("should record recent emoji when onChoose does not return false", async () => {
        const onChoose = vi.fn(() => true);
        const onRecordRecent = vi.fn();
        const { container } = render(
            <EmojiPicker onChoose={onChoose} onFinished={vi.fn()} onRecordRecent={onRecordRecent} />,
        );

        await waitFor(() => {
            expect(container.querySelector('[role="gridcell"]')).toBeInTheDocument();
        });

        await userEvent.click(container.querySelector('[role="gridcell"] [role="button"]')!);
        expect(onChoose).toHaveBeenCalledWith("😀");
        expect(onRecordRecent).toHaveBeenCalledWith("😀");
    });

    it("should not record recent emoji when onChoose returns false", async () => {
        const onRecordRecent = vi.fn();
        const { container } = render(
            <EmojiPicker onChoose={() => false} onFinished={vi.fn()} onRecordRecent={onRecordRecent} />,
        );

        await waitFor(() => {
            expect(container.querySelector('[role="gridcell"]')).toBeInTheDocument();
        });

        await userEvent.click(container.querySelector('[role="gridcell"] [role="button"]')!);
        expect(onRecordRecent).not.toHaveBeenCalled();
    });

    it("should not mangle default order after filtering", async () => {
        const ref = createRef<EmojiPicker>();
        const { container } = render(
            <EmojiPicker ref={ref} onChoose={(str: string) => false} onFinished={vi.fn()} />,
        );

        await waitFor(() => {
            expect(container.querySelector('[role="gridcell"]')).toBeInTheDocument();
        });

        // Wait for the virtualized rows to settle (out-of-view categories drop
        // their transient initial rows once measured) before capturing.
        let beforeHtml = container.innerHTML;
        await waitFor(() => {
            const current = container.innerHTML;
            if (current !== beforeHtml) {
                beforeHtml = current;
                throw new Error("virtualized rows still settling");
            }
        });

        // Apply a filter and assert that the HTML has changed
        //@ts-ignore private access
        act(() => ref.current!.onChangeFilter("test"));
        await waitFor(() => expect(beforeHtml).not.toEqual(container.innerHTML));

        // Clear the filter and assert that the HTML matches what it was before filtering
        //@ts-ignore private access
        act(() => ref.current!.onChangeFilter(""));
        await waitFor(() => expect(beforeHtml).toEqual(container.innerHTML));
    });

    it("sort emojis by shortcode and size", function () {
        const ep = new EmojiPicker({ onChoose: (str: string) => false, onFinished: vi.fn() });

        //@ts-ignore private access
        act(() => ep.onChangeFilter("heart"));

        //@ts-ignore private access
        expect(ep.memoizedDataByCategory["people"][0].shortcodes[0]).toEqual("heart");
        //@ts-ignore private access
        expect(ep.memoizedDataByCategory["people"][1].shortcodes[0]).toEqual("heartbeat");
    });

    it("should allow keyboard navigation using arrow keys", async () => {
        const onChoose = vi.fn();
        const onFinished = vi.fn();
        const { container } = render(<EmojiPicker onChoose={onChoose} onFinished={onFinished} />);

        const input = container.querySelector("input")!;
        await waitFor(() => expect(input).toHaveFocus());

        function getEmoji(): string {
            return getActiveEmojiText(container);
        }

        await waitFor(() => expect(getEmoji()).toEqual("😀"));
        // First arrow key press shows highlight without navigating
        await userEvent.keyboard("[ArrowDown]");
        expect(getEmoji()).toEqual("😀");
        // Subsequent arrow keys navigate
        await userEvent.keyboard("[ArrowDown]");
        expect(getEmoji()).toEqual("🙂");
        await userEvent.keyboard("[ArrowUp]");
        expect(getEmoji()).toEqual("😀");
        await userEvent.keyboard("Flag");
        await waitFor(() => expect(getEmoji()).not.toEqual("😀"));
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
        const onChoose = vi.fn();
        const onFinished = vi.fn();
        const { container } = render(<EmojiPicker onChoose={onChoose} onFinished={onFinished} />);

        const input = container.querySelector("input")!;
        await waitFor(() => expect(input).toHaveFocus());

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
        const onChoose = vi.fn();
        const onFinished = vi.fn();
        const { container } = render(<EmojiPicker onChoose={onChoose} onFinished={onFinished} />);

        const input = container.querySelector("input")!;
        await waitFor(() => expect(input).toHaveFocus());

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
        const onChoose = vi.fn();
        const onFinished = vi.fn();
        const { container } = render(<EmojiPicker onChoose={onChoose} onFinished={onFinished} />);

        const input = container.querySelector("input")!;
        await waitFor(() => expect(input).toHaveFocus());

        function getEmoji(): string {
            return getActiveEmojiText(container);
        }

        // Initially on first emoji
        await waitFor(() => expect(getEmoji()).toEqual("😀"));

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

    describe("Category keyboard selection", () => {
        it("check tabindex for the first category when no recent emojis", async () => {
            const { container } = render(<EmojiPicker onChoose={vi.fn()} onFinished={vi.fn()} />);

            await waitFor(() => {
                expect(container.querySelector('[data-category-id="people"]')).toBeInTheDocument();
            });

            // People category should have tabindex="0"
            const peopleTab = container.querySelector('[title*="Smileys"]');
            expect(peopleTab).toHaveAttribute("tabindex", "0");
            expect(peopleTab).toHaveAttribute("aria-selected", "true");

            // Other categories should have tabindex="-1"
            const natureTab = container.querySelector('[title*="Animals"]');
            expect(natureTab).toHaveAttribute("tabindex", "-1");
        });

        it("check tabindex for recent category when recent emojis exist", async () => {
            const { container } = render(
                <EmojiPicker recentEmojis={RECENT_EMOJIS.slice(0, 2)} onChoose={vi.fn()} onFinished={vi.fn()} />,
            );

            await waitFor(() => {
                expect(container.querySelector('[data-category-id="recent"]')).toBeInTheDocument();
            });

            // Recent category should have tabindex="0"
            const recentTab = container.querySelector('[title*="Frequently"]');
            expect(recentTab).toHaveAttribute("tabindex", "0");
            expect(recentTab).toHaveAttribute("aria-selected", "true");

            // People category should have tabindex="-1"
            const peopleTab = container.querySelector('[title*="Smileys"]');
            expect(peopleTab).toHaveAttribute("tabindex", "-1");
        });

        it("should update table position when clicking on a different category tab", async () => {
            const { container } = render(<EmojiPicker onChoose={vi.fn()} onFinished={vi.fn()} />);

            await waitFor(() => {
                expect(container.querySelector('[data-category-id="people"]')).toBeInTheDocument();
            });

            // Initially, people category should be visible
            const peopleTab = container.querySelector('[title*="Smileys"]') as HTMLButtonElement;
            expect(peopleTab).toHaveAttribute("tabindex", "0");

            // Click on nature category tab
            const natureTab = container.querySelector('[title*="Animals"]') as HTMLButtonElement;
            await userEvent.click(natureTab);

            // Wait for scroll and visibility update
            await waitFor(() => {
                const natureCategory = container.querySelector('[data-category-id="nature"]');
                expect(natureCategory).toBeInTheDocument();
            });
        });

        it("should navigate between category tabs using arrow keys", async () => {
            const { container } = render(<EmojiPicker onChoose={vi.fn()} onFinished={vi.fn()} />);

            await waitFor(() => {
                expect(container.querySelector('[data-category-id="people"]')).toBeInTheDocument();
            });

            // Focus on the category header
            const peopleTab = container.querySelector('[title*="Smileys"]') as HTMLButtonElement;
            peopleTab.focus();
            expect(peopleTab).toHaveFocus();

            // Press ArrowRight to move to next category
            await userEvent.keyboard("[ArrowRight]");

            // Should focus on next enabled category and trigger scroll
            await waitFor(() => {
                // Verify focus moved away from people tab
                expect(peopleTab).not.toHaveFocus();

                // Verify some other category tab now has focus
                const focusedTab = document.activeElement;
                expect(focusedTab?.getAttribute("role")).toBe("tab");
                expect(focusedTab).not.toBe(peopleTab);
            });
        });

        it("should navigate to first/last category using Home/End keys", async () => {
            const { container } = render(<EmojiPicker onChoose={vi.fn()} onFinished={vi.fn()} />);

            await waitFor(() => {
                expect(container.querySelector('[data-category-id="people"]')).toBeInTheDocument();
            });

            // Focus on the category header
            const peopleTab = container.querySelector('[title*="Smileys"]') as HTMLButtonElement;
            peopleTab.focus();

            // Press End to jump to last category
            await userEvent.keyboard("[End]");

            await waitFor(() => {
                const flagsTab = container.querySelector('[title*="Flags"]') as HTMLButtonElement;
                expect(flagsTab).toHaveFocus();
            });

            // Press Home to jump to first category
            await userEvent.keyboard("[Home]");

            await waitFor(() => {
                expect(peopleTab).toHaveFocus();
            });
        });
    });
});

/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2023 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { DATA_BY_CATEGORY } from "@matrix-org/emojibase-bindings";
import userEvent from "@testing-library/user-event";
import { render, waitFor, screen } from "@test-utils";
import { describe, expect, it, vi } from "vitest";

import { EmojiPicker, filterEmojis } from "./EmojiPicker";

describe("EmojiPicker", function () {
    // Recent emojis as they would be provided by the app, most used first
    const RECENT_EMOJIS = ["😀", "🎉", "❤️"];

    // Helper to get the currently active emoji's text content from the grid
    const getActiveEmojiText = (container: HTMLElement): string =>
        container.querySelector('[role="gridcell"] [tabindex="0"]')?.textContent || "";

    const getEmojiRows = (container: HTMLElement): Element[] =>
        Array.from(container.querySelectorAll('[role="row"]')).filter((row) =>
            Array.from(row.children).some((cell) => cell.querySelector('[role="button"], [role="checkbox"]')),
        );

    it("should disable the recent category when no recent emojis", () => {
        render(<EmojiPicker onChoose={() => false} onFinished={vi.fn()} />);

        const recentTab = screen.getByRole("tab", { name: "🕒" });
        expect(recentTab).toBeDisabled();
    });

    it("should select the people category by default when no recent emojis", () => {
        render(<EmojiPicker onChoose={() => false} onFinished={vi.fn()} />);

        const peopleTab = screen.getByRole("tab", { name: "😀" });
        expect(peopleTab).toHaveAttribute("aria-selected", "true");
    });

    it("should enable and select the recent category when recent emojis are supplied", () => {
        render(<EmojiPicker onChoose={() => false} onFinished={vi.fn()} recentEmojis={RECENT_EMOJIS} />);

        const recentTab = screen.getByRole("tab", { name: "🕒" });
        expect(recentTab).toBeEnabled();
        expect(recentTab).toHaveAttribute("aria-selected", "true");
    });

    it("groups emoji using the configured column count", async () => {
        const { container } = render(<EmojiPicker emojisPerRow={11} onChoose={() => false} onFinished={vi.fn()} />);

        await waitFor(() => expect(getEmojiRows(container).length).toBeGreaterThanOrEqual(2));

        const [firstRow, secondRow] = getEmojiRows(container);
        expect(firstRow.children).toHaveLength(11);
        expect(Array.from(firstRow.children, (cell) => cell.textContent)).toEqual(
            DATA_BY_CATEGORY.people.slice(0, 11).map((emoji) => emoji.unicode),
        );
        expect(secondRow.children[0]).toHaveTextContent(DATA_BY_CATEGORY.people[11].unicode);
    });

    it("falls back to the stock column count for invalid configuration", async () => {
        const { container } = render(<EmojiPicker emojisPerRow={0} onChoose={() => false} onFinished={vi.fn()} />);

        await waitFor(() => expect(getEmojiRows(container)[0]).toBeDefined());
        expect(getEmojiRows(container)[0].children).toHaveLength(8);
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
        const { container } = render(<EmojiPicker onChoose={() => false} onFinished={vi.fn()} />);

        // Extract the list of emoji currently visible in the grid
        const getVisibleEmojis = (): string[] =>
            Array.from(container.querySelectorAll('[role="gridcell"]')).map((cell) => cell.textContent || "");

        await waitFor(() => {
            expect(container.querySelector('[role="gridcell"]')).toBeInTheDocument();
        });

        // Wait for the virtualized rows to settle (out-of-view categories drop
        // their transient initial rows once measured) before capturing.
        const beforeEmojis = getVisibleEmojis();

        const input = container.querySelector("input")!;

        // Apply a filter and assert that the visible emoji have changed
        await userEvent.type(input, "test");
        await waitFor(() => expect(getVisibleEmojis()).not.toEqual(beforeEmojis));

        // There may be different numbers of emoji before after since virtuoso may
        // end up rendering more or fewer off screen. Chop any excess off so that it's
        // just the *order* we're comparing.
        await userEvent.clear(input);
        await waitFor(() => {
            const afterEmojis = getVisibleEmojis();
            const length = Math.min(beforeEmojis.length, afterEmojis.length);
            expect(afterEmojis.slice(0, length)).toEqual(beforeEmojis.slice(0, length));
        });
    });

    it("should keep the filter applied when recentEmojis prop is changed", async () => {
        const { container, rerender } = render(
            <EmojiPicker onChoose={() => false} onFinished={vi.fn()} recentEmojis={[...RECENT_EMOJIS]} />,
        );

        const getVisibleEmojis = (): string[] =>
            Array.from(container.querySelectorAll('[role="gridcell"]')).map((cell) => cell.textContent || "");

        const input = container.querySelector("input")!;
        await userEvent.type(input, "wave");
        await waitFor(() => expect(getVisibleEmojis()).toContain("👋"));
        const filtered = getVisibleEmojis();

        // add another recently used emoji but it doesn't match the filter, so it should not change what's visible.
        rerender(<EmojiPicker onChoose={() => false} onFinished={vi.fn()} recentEmojis={["🦡", ...RECENT_EMOJIS]} />);

        expect(input).toHaveValue("wave");
        expect(getVisibleEmojis()).toEqual(filtered);
    });

    it("sort emojis by shortcode and size", function () {
        const sorted = filterEmojis(DATA_BY_CATEGORY.people, "heart");

        expect(sorted[0].shortcodes[0]).toEqual("heart");
        expect(sorted[1].shortcodes[0]).toEqual("heartbeat");
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

    it("keeps same-row keyboard targets horizontally visible without moving search focus", async () => {
        const { container } = render(<EmojiPicker onChoose={() => false} onFinished={vi.fn()} />);
        const input = container.querySelector("input")!;

        await waitFor(() => expect(getEmojiRows(container)[0]?.children).toHaveLength(8));
        await waitFor(() => expect(input).toHaveFocus());
        const secondEmoji = getEmojiRows(container)[0].children[1].querySelector<HTMLElement>('[role="button"]')!;
        const scrollIntoView = vi.spyOn(secondEmoji, "scrollIntoView");

        await userEvent.keyboard("[ArrowDown]");
        await userEvent.keyboard("[ArrowRight]");

        expect(input).toHaveFocus();
        expect(scrollIntoView).toHaveBeenCalledWith({
            behavior: "auto",
            block: "nearest",
            inline: "nearest",
        });
    });

    it("moves Up and Down by the configured 11-column row geometry", async () => {
        const { container } = render(<EmojiPicker emojisPerRow={11} onChoose={() => false} onFinished={vi.fn()} />);

        await waitFor(() => expect(getActiveEmojiText(container)).toEqual(DATA_BY_CATEGORY.people[0].unicode));
        await userEvent.keyboard("[ArrowDown]");
        await userEvent.keyboard("[ArrowDown]");
        expect(getActiveEmojiText(container)).toEqual(DATA_BY_CATEGORY.people[11].unicode);

        await userEvent.keyboard("[ArrowUp]");
        expect(getActiveEmojiText(container)).toEqual(DATA_BY_CATEGORY.people[0].unicode);
    });

    it("clamps 11-column navigation to the end of a ragged row", async () => {
        const recentEmojis = DATA_BY_CATEGORY.people.slice(0, 13).map((emoji) => emoji.unicode);
        const { container } = render(
            <EmojiPicker emojisPerRow={11} recentEmojis={recentEmojis} onChoose={() => false} onFinished={vi.fn()} />,
        );

        await waitFor(() => expect(getActiveEmojiText(container)).toEqual(recentEmojis[0]));
        await userEvent.keyboard("[ArrowDown]");
        await userEvent.keyboard("[ArrowRight]".repeat(10));
        expect(getActiveEmojiText(container)).toEqual(recentEmojis[10]);

        await userEvent.keyboard("[ArrowDown]");
        expect(getActiveEmojiText(container)).toEqual(recentEmojis[12]);
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

    it("should point aria-activedescendant at the active emoji while searching", async () => {
        const { container } = render(<EmojiPicker onChoose={vi.fn()} onFinished={vi.fn()} />);

        const input = container.querySelector("input")!;
        await waitFor(() => expect(input).toHaveFocus());

        function getActiveEmoji(): HTMLElement {
            return container.querySelector<HTMLElement>('[role="gridcell"] [tabindex="0"]')!;
        }

        // With no query, the input must not claim an active descendant: doing so makes
        // screen readers read out the first emoji merely on focusing the input.
        await waitFor(() => expect(getActiveEmoji()).toBeInTheDocument());
        expect(input).not.toHaveAttribute("aria-activedescendant");

        // Once there's a query, the active emoji must be identified to screen readers,
        // which requires the emoji cells to have IDs for aria-activedescendant to target.
        await userEvent.type(input, "te");
        await waitFor(() => expect(getActiveEmoji().textContent).toEqual("🧑‍🏫"));

        const activeId = getActiveEmoji().id;
        expect(activeId).not.toEqual("");
        expect(input).toHaveAttribute("aria-activedescendant", activeId);
        expect(container.querySelectorAll(`[id="${activeId}"]`)).toHaveLength(1);

        // ...and it must follow the selection as the query changes
        await userEvent.type(input, "s");
        await waitFor(() => expect(getActiveEmoji().textContent).toEqual("🧪"));
        expect(input).toHaveAttribute("aria-activedescendant", getActiveEmoji().id);
        expect(getActiveEmoji().id).not.toEqual(activeId);
    });

    describe("Preview fallback", () => {
        const getFooter = (): HTMLElement => screen.getByLabelText("Emoji picker").lastElementChild as HTMLElement;

        it("shows a supplied grinning-face fallback instead of Quick Reactions", async () => {
            render(<EmojiPicker previewFallbackEmoji="😀" onChoose={() => false} onFinished={vi.fn()} />);

            await waitFor(() => expect(getFooter()).toHaveTextContent("😀"));
            expect(screen.queryByRole("toolbar", { name: "Quick Reactions" })).not.toBeInTheDocument();
        });

        it("shows a supplied ordered-recent fallback", async () => {
            render(
                <EmojiPicker
                    recentEmojis={["🎉", "😀"]}
                    previewFallbackEmoji="🎉"
                    onChoose={() => false}
                    onFinished={vi.fn()}
                />,
            );

            await waitFor(() => expect(getFooter()).toHaveTextContent("🎉"));
        });

        it("gives hover Preview precedence and restores the fallback on mouse leave", async () => {
            const { container } = render(
                <EmojiPicker previewFallbackEmoji="😀" onChoose={() => false} onFinished={vi.fn()} />,
            );

            await waitFor(() => expect(getEmojiRows(container)[0]).toBeDefined());
            const hoveredEmoji = DATA_BY_CATEGORY.people[1].unicode;
            const hoveredButton = getEmojiRows(container)[0].children[1].querySelector<HTMLElement>('[role="button"]')!;

            await userEvent.hover(hoveredButton);
            expect(getFooter()).toHaveTextContent(hoveredEmoji);
            expect(getFooter()).not.toHaveTextContent("😀");

            await userEvent.unhover(hoveredButton);
            expect(getFooter()).toHaveTextContent("😀");
        });

        it("keeps the stock footerless behavior when Quick Reactions are disabled", async () => {
            render(
                <EmojiPicker
                    showQuickReactions={false}
                    previewFallbackEmoji="😀"
                    onChoose={() => false}
                    onFinished={vi.fn()}
                />,
            );

            const picker = screen.getByLabelText("Emoji picker");
            await waitFor(() => expect(picker.querySelector('[role="gridcell"]')).toBeInTheDocument());
            expect(picker.children).toHaveLength(3);
        });
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
            const peopleTab = container.querySelector('[title*="Smileys"]')!;
            expect(peopleTab).toHaveAttribute("tabindex", "0");

            // Click on nature category tab
            const natureTab = container.querySelector('[title*="Animals"]')!;
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
            const peopleTab = container.querySelector<HTMLButtonElement>('[title*="Smileys"]')!;
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

        it("exposes vertical orientation and navigates categories with Down", async () => {
            const { container } = render(
                <EmojiPicker categoryOrientation="vertical" onChoose={vi.fn()} onFinished={vi.fn()} />,
            );

            const tablist = screen.getByRole("tablist", { name: "Categories" });
            expect(tablist).toHaveAttribute("aria-orientation", "vertical");

            const peopleTab = container.querySelector<HTMLButtonElement>('[title*="Smileys"]')!;
            const natureTab = container.querySelector<HTMLButtonElement>('[title*="Animals"]')!;
            peopleTab.focus();

            await userEvent.keyboard("[ArrowDown]");
            expect(natureTab).toHaveFocus();
        });

        it("retains Left and Right aliases in vertical orientation", async () => {
            const { container, unmount } = render(
                <EmojiPicker categoryOrientation="vertical" onChoose={vi.fn()} onFinished={vi.fn()} />,
            );

            const peopleTab = container.querySelector<HTMLButtonElement>('[title*="Smileys"]')!;
            const natureTab = container.querySelector<HTMLButtonElement>('[title*="Animals"]')!;
            peopleTab.focus();

            await userEvent.keyboard("[ArrowRight]");
            expect(natureTab).toHaveFocus();

            unmount();
            const secondRender = render(
                <EmojiPicker categoryOrientation="vertical" onChoose={vi.fn()} onFinished={vi.fn()} />,
            );
            const secondPeopleTab = secondRender.container.querySelector<HTMLButtonElement>('[title*="Smileys"]')!;
            const flagsTab = secondRender.container.querySelector<HTMLButtonElement>('[title*="Flags"]')!;
            secondPeopleTab.focus();

            await userEvent.keyboard("[ArrowLeft]");
            expect(flagsTab).toHaveFocus();
        });

        it("skips the disabled Recent category when wrapping vertically", async () => {
            const { container } = render(
                <EmojiPicker categoryOrientation="vertical" onChoose={vi.fn()} onFinished={vi.fn()} />,
            );

            const peopleTab = container.querySelector<HTMLButtonElement>('[title*="Smileys"]')!;
            const flagsTab = container.querySelector<HTMLButtonElement>('[title*="Flags"]')!;
            expect(screen.getByRole("tab", { name: "🕒" })).toBeDisabled();
            peopleTab.focus();

            await userEvent.keyboard("[ArrowUp]");
            expect(flagsTab).toHaveFocus();
        });

        it("should navigate to first/last category using Home/End keys", async () => {
            const { container } = render(<EmojiPicker onChoose={vi.fn()} onFinished={vi.fn()} />);

            await waitFor(() => {
                expect(container.querySelector('[data-category-id="people"]')).toBeInTheDocument();
            });

            // Focus on the category header
            const peopleTab = container.querySelector<HTMLButtonElement>('[title*="Smileys"]')!;
            peopleTab.focus();

            // Press End to jump to last category
            await userEvent.keyboard("[End]");

            await waitFor(() => {
                const flagsTab = container.querySelector('[title*="Flags"]')!;
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

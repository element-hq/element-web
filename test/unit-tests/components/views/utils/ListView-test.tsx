/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, fireEvent } from "jest-matrix-react";
import { VirtuosoMockContext } from "react-virtuoso";

import { ListView, type IListViewProps } from "../../../../../src/components/utils/ListView";

interface TestItem {
    id: string;
    name: string;
    isFocusable?: boolean;
}

const SEPARATOR_ITEM = "SEPARATOR" as const;
type TestItemWithSeparator = TestItem | typeof SEPARATOR_ITEM;

describe("ListView", () => {
    const mockGetItemComponent = jest.fn();
    const mockIsItemFocusable = jest.fn();

    const defaultItems: TestItemWithSeparator[] = [
        { id: "1", name: "Item 1" },
        SEPARATOR_ITEM,
        { id: "2", name: "Item 2" },
        { id: "3", name: "Item 3" },
    ];

    const defaultProps: IListViewProps<TestItemWithSeparator, any> = {
        items: defaultItems,
        getItemComponent: mockGetItemComponent,
        isItemFocusable: mockIsItemFocusable,
        getItemKey: (item) => (typeof item === "string" ? item : item.id),
    };

    const getListViewComponent = (props: Partial<IListViewProps<TestItemWithSeparator, any>> = {}) => {
        const mergedProps = { ...defaultProps, ...props };
        return <ListView {...mergedProps} role="grid" aria-rowcount={props.items?.length} aria-colcount={1} />;
    };

    const renderListViewWithHeight = (props: Partial<IListViewProps<TestItemWithSeparator, any>> = {}) => {
        const mergedProps = { ...defaultProps, ...props };
        return render(getListViewComponent(mergedProps), {
            wrapper: ({ children }) => (
                <VirtuosoMockContext.Provider value={{ viewportHeight: 400, itemHeight: 56 }}>
                    <>{children}</>
                </VirtuosoMockContext.Provider>
            ),
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetItemComponent.mockImplementation((index: number, item: TestItemWithSeparator, context: any) => {
            const itemKey = typeof item === "string" ? item : item.id;
            const isFocused = context.tabIndexKey === itemKey;
            return (
                <div className="mx_item" data-testid={`row-${index}`} tabIndex={isFocused ? 0 : -1}>
                    {item === SEPARATOR_ITEM ? "---" : (item as TestItem).name}
                </div>
            );
        });
        mockIsItemFocusable.mockImplementation((item: TestItemWithSeparator) => item !== SEPARATOR_ITEM);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("Rendering", () => {
        it("should render the ListView component", () => {
            renderListViewWithHeight();
            expect(screen.getByRole("grid")).toBeInTheDocument();
        });

        it("should render with empty items array", () => {
            renderListViewWithHeight({ items: [] });
            expect(screen.getByRole("grid")).toBeInTheDocument();
        });
    });

    describe("Keyboard Navigation", () => {
        it("should handle ArrowDown key navigation", () => {
            renderListViewWithHeight();
            const container = screen.getByRole("grid");

            fireEvent.focus(container);
            fireEvent.keyDown(container, { code: "ArrowDown" });

            // ArrowDown should skip the non-focusable item at index 1 and go to index 2
            const items = container.querySelectorAll(".mx_item");
            expect(items[2]).toHaveAttribute("tabindex", "0");
            expect(items[0]).toHaveAttribute("tabindex", "-1");
            expect(items[1]).toHaveAttribute("tabindex", "-1");
        });

        it("should handle ArrowUp key navigation", () => {
            renderListViewWithHeight();
            const container = screen.getByRole("grid");

            // First focus and navigate down to second item
            fireEvent.focus(container);
            fireEvent.keyDown(container, { code: "ArrowDown" });

            // Then navigate back up
            fireEvent.keyDown(container, { code: "ArrowUp" });

            // Verify focus moved back to first item
            const items = container.querySelectorAll(".mx_item");
            expect(items[0]).toHaveAttribute("tabindex", "0");
            expect(items[1]).toHaveAttribute("tabindex", "-1");
        });

        it("should handle Home key navigation", () => {
            renderListViewWithHeight();
            const container = screen.getByRole("grid");

            // First focus and navigate to a later item
            fireEvent.focus(container);
            fireEvent.keyDown(container, { code: "ArrowDown" });
            fireEvent.keyDown(container, { code: "ArrowDown" });

            // Then press Home to go to first item
            fireEvent.keyDown(container, { code: "Home" });

            // Verify focus moved to first item
            const items = container.querySelectorAll(".mx_item");
            expect(items[0]).toHaveAttribute("tabindex", "0");
            // Check that other items are not focused
            for (let i = 1; i < items.length; i++) {
                expect(items[i]).toHaveAttribute("tabindex", "-1");
            }
        });

        it("should handle End key navigation", () => {
            renderListViewWithHeight();
            const container = screen.getByRole("grid");

            // First focus on the list (starts at first item)
            fireEvent.focus(container);

            // Then press End to go to last item
            fireEvent.keyDown(container, { code: "End" });

            // Verify focus moved to last visible item
            const items = container.querySelectorAll(".mx_item");
            // Should focus on the last visible item
            const lastIndex = items.length - 1;
            expect(items[lastIndex]).toHaveAttribute("tabindex", "0");
            // Check that other items are not focused
            for (let i = 0; i < lastIndex; i++) {
                expect(items[i]).toHaveAttribute("tabindex", "-1");
            }
        });

        it("should handle PageDown key navigation", () => {
            renderListViewWithHeight();
            const container = screen.getByRole("grid");

            // First focus on the list (starts at first item)
            fireEvent.focus(container);

            // Then press PageDown to jump down by viewport size
            fireEvent.keyDown(container, { code: "PageDown" });

            // Verify focus moved down
            const items = container.querySelectorAll(".mx_item");
            // PageDown should move to the last visible item since we only have 4 items
            const lastIndex = items.length - 1;
            expect(items[lastIndex]).toHaveAttribute("tabindex", "0");
            expect(items[0]).toHaveAttribute("tabindex", "-1");
        });

        it("should handle PageUp key navigation", () => {
            renderListViewWithHeight();
            const container = screen.getByRole("grid");

            // First focus and navigate to last item to have something to page up from
            fireEvent.focus(container);
            fireEvent.keyDown(container, { code: "End" });

            // Then press PageUp to jump up by viewport size
            fireEvent.keyDown(container, { code: "PageUp" });

            // Verify focus moved up
            const items = container.querySelectorAll(".mx_item");
            // PageUp should move back to the first item since we only have 4 items
            expect(items[0]).toHaveAttribute("tabindex", "0");
            const lastIndex = items.length - 1;
            expect(items[lastIndex]).toHaveAttribute("tabindex", "-1");
        });

        it("should not handle keyboard navigation when modifier keys are pressed", () => {
            renderListViewWithHeight();
            const container = screen.getByRole("grid");

            fireEvent.focus(container);

            // Store initial state - first item should be focused
            const initialItems = container.querySelectorAll(".mx_item");
            expect(initialItems[0]).toHaveAttribute("tabindex", "0");
            expect(initialItems[2]).toHaveAttribute("tabindex", "-1");

            // Test ArrowDown with Ctrl modifier - should NOT navigate
            fireEvent.keyDown(container, { code: "ArrowDown", ctrlKey: true });

            let items = container.querySelectorAll(".mx_item");
            expect(items[0]).toHaveAttribute("tabindex", "0"); // Should still be on first item
            expect(items[2]).toHaveAttribute("tabindex", "-1"); // Should not have moved to third item

            // Test ArrowDown with Alt modifier - should NOT navigate
            fireEvent.keyDown(container, { code: "ArrowDown", altKey: true });

            items = container.querySelectorAll(".mx_item");
            expect(items[0]).toHaveAttribute("tabindex", "0"); // Should still be on first item
            expect(items[2]).toHaveAttribute("tabindex", "-1"); // Should not have moved to third item

            // Test ArrowDown with Shift modifier - should NOT navigate
            fireEvent.keyDown(container, { code: "ArrowDown", shiftKey: true });

            items = container.querySelectorAll(".mx_item");
            expect(items[0]).toHaveAttribute("tabindex", "0"); // Should still be on first item
            expect(items[2]).toHaveAttribute("tabindex", "-1"); // Should not have moved to third item

            // Test ArrowDown with Meta/Cmd modifier - should NOT navigate
            fireEvent.keyDown(container, { code: "ArrowDown", metaKey: true });

            items = container.querySelectorAll(".mx_item");
            expect(items[0]).toHaveAttribute("tabindex", "0"); // Should still be on first item
            expect(items[2]).toHaveAttribute("tabindex", "-1"); // Should not have moved to third item

            // Test normal ArrowDown without modifiers - SHOULD navigate
            fireEvent.keyDown(container, { code: "ArrowDown" });

            items = container.querySelectorAll(".mx_item");
            expect(items[0]).toHaveAttribute("tabindex", "-1"); // Should have moved from first item
            expect(items[2]).toHaveAttribute("tabindex", "0"); // Should have moved to third item (skipping separator)
        });

        it("should skip non-focusable items when navigating down", async () => {
            // Create items where every other item is not focusable
            const mixedItems = [
                { id: "1", name: "Item 1", isFocusable: true },
                { id: "2", name: "Item 2", isFocusable: false },
                { id: "3", name: "Item 3", isFocusable: true },
                SEPARATOR_ITEM,
                { id: "4", name: "Item 4", isFocusable: true },
            ];

            mockIsItemFocusable.mockImplementation((item: TestItemWithSeparator) => {
                if (item === SEPARATOR_ITEM) return false;
                return (item as TestItem).isFocusable !== false;
            });

            renderListViewWithHeight({ items: mixedItems });
            const container = screen.getByRole("grid");

            fireEvent.focus(container);
            fireEvent.keyDown(container, { code: "ArrowDown" });

            // Verify it skipped the non-focusable item at index 1
            // and went directly to the focusable item at index 2
            const items = container.querySelectorAll(".mx_item");
            expect(items[2]).toHaveAttribute("tabindex", "0"); // Item 3 is focused
            expect(items[0]).toHaveAttribute("tabindex", "-1"); // Item 1 is not focused
            expect(items[1]).toHaveAttribute("tabindex", "-1"); // Item 2 (non-focusable) is not focused
        });

        it("should skip non-focusable items when navigating up", () => {
            const mixedItems = [
                { id: "1", name: "Item 1", isFocusable: true },
                SEPARATOR_ITEM,
                { id: "2", name: "Item 2", isFocusable: false },
                { id: "3", name: "Item 3", isFocusable: true },
            ];

            mockIsItemFocusable.mockImplementation((item: TestItemWithSeparator) => {
                if (item === SEPARATOR_ITEM) return false;
                return (item as TestItem).isFocusable !== false;
            });

            renderListViewWithHeight({ items: mixedItems });
            const container = screen.getByRole("grid");

            // Focus and go to last item first, then navigate up
            fireEvent.focus(container);
            fireEvent.keyDown(container, { code: "End" });
            fireEvent.keyDown(container, { code: "ArrowUp" });

            // Verify it skipped non-focusable items
            // and went to the first focusable item
            const items = container.querySelectorAll(".mx_item");
            expect(items[0]).toHaveAttribute("tabindex", "0"); // Item 1 is focused
            expect(items[3]).toHaveAttribute("tabindex", "-1"); // Item 3 is not focused anymore
        });
    });

    describe("Focus Management", () => {
        it("should focus first item when list gains focus for the first time", () => {
            renderListViewWithHeight();
            const container = screen.getByRole("grid");

            // Initial focus should go to first item
            fireEvent.focus(container);

            // Verify first item gets focus
            const items = container.querySelectorAll(".mx_item");
            expect(items[0]).toHaveAttribute("tabindex", "0");
            // Other items should not be focused
            for (let i = 1; i < items.length; i++) {
                expect(items[i]).toHaveAttribute("tabindex", "-1");
            }
        });

        it("should restore last focused item when regaining focus", () => {
            renderListViewWithHeight();
            const container = screen.getByRole("grid");

            // Focus and navigate to simulate previous usage
            fireEvent.focus(container);
            fireEvent.keyDown(container, { code: "ArrowDown" });

            // Verify item 2 is focused
            let items = container.querySelectorAll(".mx_item");
            expect(items[2]).toHaveAttribute("tabindex", "0"); // ArrowDown skips to item 2

            // Simulate blur by focusing elsewhere
            fireEvent.blur(container);

            // Regain focus should restore last position
            fireEvent.focus(container);

            // Verify focus is restored to the previously focused item
            items = container.querySelectorAll(".mx_item");
            expect(items[2]).toHaveAttribute("tabindex", "0"); // Should still be item 2
        });

        it("should not interfere with focus if item is already focused", () => {
            renderListViewWithHeight();
            const container = screen.getByRole("grid");

            // Focus once
            fireEvent.focus(container);

            // Focus again when already focused
            fireEvent.focus(container);

            expect(container).toBeInTheDocument();
        });

        it("should not scroll to top when clicking an item after manual scroll", () => {
            // Create a larger list to enable meaningful scrolling
            const largerItems = Array.from({ length: 50 }, (_, i) => ({
                id: `item-${i}`,
                name: `Item ${i}`,
            }));

            const mockOnClick = jest.fn();

            mockGetItemComponent.mockImplementation(
                (index: number, item: TestItemWithSeparator, context: any, onFocus: (e: React.FocusEvent) => void) => {
                    const itemKey = typeof item === "string" ? item : item.id;
                    const isFocused = context.tabIndexKey === itemKey;
                    return (
                        <div
                            className="mx_item"
                            data-testid={`row-${index}`}
                            tabIndex={isFocused ? 0 : -1}
                            onClick={() => mockOnClick(item)}
                            onFocus={onFocus}
                        >
                            {item === SEPARATOR_ITEM ? "---" : (item as TestItem).name}
                        </div>
                    );
                },
            );

            const { container } = renderListViewWithHeight({ items: largerItems });
            const listContainer = screen.getByRole("grid");

            // Step 1: Focus the list initially (this sets tabIndexKey to first item: "item-0")
            fireEvent.focus(listContainer);

            // Verify first item is focused initially and tabIndexKey is set to first item
            let items = container.querySelectorAll(".mx_item");
            expect(items[0]).toHaveAttribute("tabindex", "0");
            expect(items[0]).toHaveAttribute("data-testid", "row-0");

            // Step 2: Simulate manual scrolling (mouse wheel, scroll bar drag, etc.)
            // This changes which items are visible but DOES NOT change tabIndexKey
            // tabIndexKey should still point to "item-0" but "item-0" is no longer visible
            fireEvent.scroll(listContainer, { target: { scrollTop: 300 } });

            // Step 3: After scrolling, different items should now be visible
            // but tabIndexKey should still point to "item-0" (which is no longer visible)
            items = container.querySelectorAll(".mx_item");

            // Verify that item-0 is no longer in the DOM (because it's scrolled out of view)
            const item0 = container.querySelector("[data-testid='row-0']");
            expect(item0).toBeNull();

            // Find a visible item to click on (should be items from further down the list)
            const visibleItems = container.querySelectorAll(".mx_item");
            expect(visibleItems.length).toBeGreaterThan(0);
            const clickTargetItem = visibleItems[0]; // Click on the first visible item

            // Click on the visible item
            fireEvent.click(clickTargetItem);

            // The click should trigger the onFocus callback, which updates the tabIndexKey
            // This simulates the real user interaction where clicking an item focuses it
            fireEvent.focus(clickTargetItem);

            // Verify the click was handled
            expect(mockOnClick).toHaveBeenCalled();

            // With the fix applied: the clicked item should become focused (tabindex="0")
            // This validates that the fix prevents unwanted scrolling back to the top
            expect(clickTargetItem).toHaveAttribute("tabindex", "0");

            // The key validation: ensure we haven't scrolled back to the top
            // item-0 should still not be visible (if the fix is working)
            const item0AfterClick = container.querySelector("[data-testid='row-0']");
            expect(item0AfterClick).toBeNull();
        });
    });

    describe("Accessibility", () => {
        it("should set correct ARIA attributes", () => {
            renderListViewWithHeight();
            const container = screen.getByRole("grid");

            expect(container).toHaveAttribute("role", "grid");
            expect(container).toHaveAttribute("aria-rowcount", "4");
            expect(container).toHaveAttribute("aria-colcount", "1");
        });

        it("should update aria-rowcount when items change", () => {
            const { rerender } = renderListViewWithHeight();
            let container = screen.getByRole("grid");
            expect(container).toHaveAttribute("aria-rowcount", "4");

            // Update with fewer items
            const fewerItems = [
                { id: "1", name: "Item 1" },
                { id: "2", name: "Item 2" },
            ];
            rerender(
                getListViewComponent({
                    ...defaultProps,
                    items: fewerItems,
                }),
            );

            container = screen.getByRole("grid");
            expect(container).toHaveAttribute("aria-rowcount", "2");
        });

        it("should handle custom ARIA label", () => {
            renderListViewWithHeight({ "aria-label": "Custom list label" });
            const container = screen.getByRole("grid");

            expect(container).toHaveAttribute("aria-label", "Custom list label");
        });
    });
});

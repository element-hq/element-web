/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type PropsWithChildren } from "react";
import { render, screen, fireEvent, waitFor, act } from "@test-utils";
import { VirtuosoMockContext } from "react-virtuoso";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { FlatVirtualizedList, type FlatVirtualizedListProps } from "./FlatVirtualizedList";
import { GroupedVirtualizedList, type GroupedVirtualizedListProps } from "./GroupedVirtualizedList";
import type { VirtualizedListContext } from "./virtualized-list";

// ─── Test types ──────────────────────────────────────────────────────────────

interface TestItem {
    id: string;
    name: string;
    isFocusable?: boolean;
}

const SEPARATOR_ITEM = "SEPARATOR" as const;
type TestItemWithSeparator = TestItem | typeof SEPARATOR_ITEM;

interface TestGroupHeader {
    id: string;
    name: string;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

const expectTabIndex = (element: Element, expected: string): void => {
    expect(element.getAttribute("tabindex")).toBe(expected);
};

const expectAttribute = (element: Element, attr: string, expected: string): void => {
    expect(element.getAttribute(attr)).toBe(expected);
};

const getItemKey = (item: TestItemWithSeparator): string => (typeof item === "string" ? item : item.id);

/** Renders an item element used by the default mock. */
function renderItemElement(
    index: number,
    item: TestItemWithSeparator,
    context: VirtualizedListContext<any>,
): React.JSX.Element {
    const itemKey = typeof item === "string" ? item : item.id;
    const isFocused = context.tabIndexKey === itemKey;
    return (
        <div className="mx_item" data-testid={`row-${index}`} tabIndex={isFocused ? 0 : -1} role="gridcell">
            {item === SEPARATOR_ITEM ? "---" : (item as TestItem).name}
        </div>
    );
}

/** Renders a clickable item element used by the scroll-click test mock. */
function renderClickableItemElement(
    index: number,
    item: TestItemWithSeparator,
    context: VirtualizedListContext<any>,
    onFocus: (item: TestItemWithSeparator, e: React.FocusEvent) => void,
    onClick: () => void,
): React.JSX.Element {
    const itemKey = typeof item === "string" ? item : item.id;
    const isFocused = context.tabIndexKey === itemKey;
    return (
        <div
            className="mx_item"
            data-testid={`row-${index}`}
            tabIndex={isFocused ? 0 : -1}
            role="button"
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    onClick();
                }
            }}
            onFocus={(e) => onFocus(item, e)}
        >
            {item === SEPARATOR_ITEM ? "---" : (item as TestItem).name}
        </div>
    );
}

// ─── Variant definitions ─────────────────────────────────────────────────────

interface ListTestVariant {
    name: string;
    /** Build the JSX element for the given items and props. */
    createComponent: (
        items: TestItemWithSeparator[],
        mockGetItemComponent: any,
        mockIsItemFocusable: any,
        extraProps?: Record<string, unknown>,
    ) => React.JSX.Element;
    /** Wire up the default `getItemComponent` mock (simple items, no onFocus). */
    setupDefaultMock: (mockGetItemComponent: any, getItems: () => TestItemWithSeparator[]) => void;
    /** Wire up the `getItemComponent` mock for the click-after-scroll test. */
    setupClickTestMock: (mockGetItemComponent: any, mockOnClick: any, getItems: () => TestItemWithSeparator[]) => void;
    /** Number of ArrowDown key presses after initial focus to reach the first regular item.
     *  0 for flat lists, 1 for grouped lists (to skip past the group header). */
    stepsToFirstItem: number;
    /** CSS selector matching all elements that participate in keyboard navigation. */
    navigableSelector: string;
}

const flatVariant: ListTestVariant = {
    name: "FlatVirtualizedList",
    stepsToFirstItem: 0,
    navigableSelector: ".mx_item",

    createComponent(items, mockGetItemComponent, mockIsItemFocusable, extraProps = {}) {
        const props: FlatVirtualizedListProps<TestItemWithSeparator, any> = {
            items,
            "getItemComponent": mockGetItemComponent,
            "isItemFocusable": mockIsItemFocusable,
            getItemKey,
            "role": "grid",
            "aria-rowcount": items.length,
            "aria-colcount": 1,
            ...extraProps,
        };
        return <FlatVirtualizedList {...props} />;
    },

    setupDefaultMock(mockGetItemComponent, _getItems) {
        mockGetItemComponent.mockImplementation(
            (index: number, item: TestItemWithSeparator, context: VirtualizedListContext<any>) =>
                renderItemElement(index, item, context),
        );
    },

    setupClickTestMock(mockGetItemComponent, mockOnClick, _getItems) {
        mockGetItemComponent.mockImplementation(
            (
                index: number,
                item: TestItemWithSeparator,
                context: VirtualizedListContext<any>,
                onFocus: (item: TestItemWithSeparator, e: React.FocusEvent) => void,
            ) => renderClickableItemElement(index, item, context, onFocus, () => mockOnClick(item)),
        );
    },
};

const groupedVariant: ListTestVariant = {
    name: "GroupedVirtualizedList",
    stepsToFirstItem: 1,
    navigableSelector: ".mx_group_header, .mx_item",

    createComponent(items, mockGetItemComponent, mockIsItemFocusable, extraProps = {}) {
        const header: TestGroupHeader = { id: "test-group-header", name: "Group 0" };
        const props: GroupedVirtualizedListProps<TestGroupHeader, TestItemWithSeparator, any> = {
            "groups": [{ header, items }],
            "getItemComponent": mockGetItemComponent,
            "getGroupHeaderComponent": (
                _groupIndex: number,
                header: TestGroupHeader,
                context: VirtualizedListContext<any>,
                onFocus: (header: TestGroupHeader, e: React.FocusEvent) => void,
            ) => (
                <div
                    className="mx_group_header"
                    data-testid={`group-header-${header.id}`}
                    tabIndex={context.tabIndexKey === header.id ? 0 : -1}
                    onFocus={(e) => onFocus(header, e)}
                >
                    {header.name}
                </div>
            ),
            "isGroupHeaderFocusable": () => true,
            "isItemFocusable": mockIsItemFocusable,
            getItemKey,
            "getHeaderKey": (header) => header.id,
            "role": "grid",
            "aria-rowcount": items.length,
            "aria-colcount": 1,
            ...extraProps,
        };
        return <GroupedVirtualizedList {...props} />;
    },

    setupDefaultMock(mockGetItemComponent, _getItems) {
        mockGetItemComponent.mockImplementation(
            (index: number, item: TestItemWithSeparator, context: VirtualizedListContext<any>) =>
                renderItemElement(index, item, context),
        );
    },

    setupClickTestMock(mockGetItemComponent, mockOnClick, _getItems) {
        mockGetItemComponent.mockImplementation(
            (
                index: number,
                item: TestItemWithSeparator,
                context: VirtualizedListContext<any>,
                onFocus: (item: TestItemWithSeparator, e: React.FocusEvent) => void,
            ) => renderClickableItemElement(index, item, context, onFocus, () => mockOnClick(item)),
        );
    },
};

// ─── Shared test suite ───────────────────────────────────────────────────────

const virtuosoWrapper = ({ children }: PropsWithChildren): React.JSX.Element => (
    <VirtuosoMockContext.Provider value={{ viewportHeight: 400, itemHeight: 56 }}>
        {children}
    </VirtuosoMockContext.Provider>
);

describe.each<ListTestVariant>([flatVariant, groupedVariant])("$name", (variant) => {
    const mockGetItemComponent = vi.fn();
    const mockIsItemFocusable = vi.fn();

    const defaultItems: TestItemWithSeparator[] = [
        { id: "1", name: "Item 1" },
        SEPARATOR_ITEM,
        { id: "2", name: "Item 2" },
        { id: "3", name: "Item 3" },
    ];

    /** Tracks whichever items were most recently passed to render / rerender,
     *  so the grouped variant's mock can look them up by index. */
    let currentItems: TestItemWithSeparator[] = defaultItems;

    const getListComponent = (
        items: TestItemWithSeparator[],
        extraProps: Record<string, unknown> = {},
    ): React.JSX.Element => {
        currentItems = items;
        return variant.createComponent(items, mockGetItemComponent, mockIsItemFocusable, extraProps);
    };

    const renderListWithHeight = (
        overrides: { items?: TestItemWithSeparator[] } & Record<string, unknown> = {},
    ): ReturnType<typeof render> => {
        const { items: overrideItems, ...extraProps } = overrides;
        const items = overrideItems ?? defaultItems;
        return render(getListComponent(items, extraProps), { wrapper: virtuosoWrapper });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        currentItems = defaultItems;
        variant.setupDefaultMock(mockGetItemComponent, () => currentItems);
        mockIsItemFocusable.mockImplementation((item: TestItemWithSeparator) => item !== SEPARATOR_ITEM);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe("Rendering", () => {
        it("should render the VirtualizedList component", () => {
            renderListWithHeight();
            expect(screen.getByRole("grid")).toBeDefined();
        });

        it("should render with empty items array", () => {
            renderListWithHeight({ items: [] });
            expect(screen.getByRole("grid")).toBeDefined();
        });
    });

    /** Press ArrowDown the required number of times to move from the initial
     *  focus target (e.g. a group header) to the first regular item. */
    const navigateToFirstItem = (container: Element): void => {
        for (let i = 0; i < variant.stepsToFirstItem; i++) {
            fireEvent.keyDown(container, { code: "ArrowDown" });
        }
    };

    describe("Keyboard Navigation", () => {
        it("should handle ArrowDown key navigation", () => {
            renderListWithHeight();
            const container = screen.getByRole("grid");

            fireEvent.focus(container);
            navigateToFirstItem(container);
            fireEvent.keyDown(container, { code: "ArrowDown" });

            // ArrowDown should skip the non-focusable item at index 1 and go to index 2
            const items = container.querySelectorAll(".mx_item");
            expectTabIndex(items[2], "0");
            expectTabIndex(items[0], "-1");
            expectTabIndex(items[1], "-1");
        });

        it("should handle ArrowUp key navigation", () => {
            renderListWithHeight();
            const container = screen.getByRole("grid");

            // First focus and navigate down past separator
            fireEvent.focus(container);
            navigateToFirstItem(container);
            fireEvent.keyDown(container, { code: "ArrowDown" });

            // Then navigate back up
            fireEvent.keyDown(container, { code: "ArrowUp" });

            // Verify focus moved back to first item
            const items = container.querySelectorAll(".mx_item");
            expectTabIndex(items[0], "0");
            expectTabIndex(items[1], "-1");
        });

        it("should handle Home key navigation", () => {
            renderListWithHeight();
            const container = screen.getByRole("grid");

            // First focus and navigate to a later item
            fireEvent.focus(container);
            navigateToFirstItem(container);
            fireEvent.keyDown(container, { code: "ArrowDown" });
            fireEvent.keyDown(container, { code: "ArrowDown" });

            // Then press Home to go to first navigable element
            fireEvent.keyDown(container, { code: "Home" });

            // Verify focus moved to the very first navigable element
            const allNav = container.querySelectorAll(variant.navigableSelector);
            expectTabIndex(allNav[0], "0");
            // Check that other navigable elements are not focused
            for (let i = 1; i < allNav.length; i++) {
                expectTabIndex(allNav[i], "-1");
            }
        });

        it("should handle End key navigation", () => {
            renderListWithHeight();
            const container = screen.getByRole("grid");

            // First focus on the list
            fireEvent.focus(container);

            // Then press End to go to last item
            fireEvent.keyDown(container, { code: "End" });

            // Verify focus moved to last visible navigable element
            const allNav = container.querySelectorAll(variant.navigableSelector);
            const lastIndex = allNav.length - 1;
            expectTabIndex(allNav[lastIndex], "0");
            // Check that other navigable elements are not focused
            for (let i = 0; i < lastIndex; i++) {
                expectTabIndex(allNav[i], "-1");
            }
        });

        it("should handle PageDown key navigation", () => {
            renderListWithHeight();
            const container = screen.getByRole("grid");

            // First focus on the list and navigate to first item
            fireEvent.focus(container);
            navigateToFirstItem(container);

            // Then press PageDown to jump down by viewport size
            fireEvent.keyDown(container, { code: "PageDown" });

            // Verify focus moved down
            const items = container.querySelectorAll(".mx_item");
            // PageDown should move to the last visible item since we only have 4 items
            const lastIndex = items.length - 1;
            expectTabIndex(items[lastIndex], "0");
            expectTabIndex(items[0], "-1");
        });

        it("should handle PageUp key navigation", () => {
            renderListWithHeight();
            const container = screen.getByRole("grid");

            // First focus, navigate to first item, then End
            fireEvent.focus(container);
            navigateToFirstItem(container);
            fireEvent.keyDown(container, { code: "End" });

            // Then press PageUp to jump up by viewport size
            fireEvent.keyDown(container, { code: "PageUp" });

            // PageUp commits focus to the last visible item after the viewport settles.
            const items = container.querySelectorAll(".mx_item");
            const lastIndex = items.length - 1;
            expectTabIndex(items[lastIndex], "0");
        });

        it("should not handle keyboard navigation when modifier keys are pressed", () => {
            renderListWithHeight();
            const container = screen.getByRole("grid");

            fireEvent.focus(container);
            navigateToFirstItem(container);

            // Store initial state - first item should be focused
            const initialItems = container.querySelectorAll(".mx_item");
            expectTabIndex(initialItems[0], "0");
            expectTabIndex(initialItems[2], "-1");

            // Test ArrowDown with Ctrl modifier - should NOT navigate
            fireEvent.keyDown(container, { code: "ArrowDown", ctrlKey: true });

            let items = container.querySelectorAll(".mx_item");
            expectTabIndex(items[0], "0"); // Should still be on first item
            expectTabIndex(items[2], "-1"); // Should not have moved to third item

            // Test ArrowDown with Alt modifier - should NOT navigate
            fireEvent.keyDown(container, { code: "ArrowDown", altKey: true });

            items = container.querySelectorAll(".mx_item");
            expectTabIndex(items[0], "0"); // Should still be on first item
            expectTabIndex(items[2], "-1"); // Should not have moved to third item

            // Test ArrowDown with Shift modifier - should NOT navigate
            fireEvent.keyDown(container, { code: "ArrowDown", shiftKey: true });

            items = container.querySelectorAll(".mx_item");
            expectTabIndex(items[0], "0"); // Should still be on first item
            expectTabIndex(items[2], "-1"); // Should not have moved to third item

            // Test ArrowDown with Meta/Cmd modifier - should NOT navigate
            fireEvent.keyDown(container, { code: "ArrowDown", metaKey: true });

            items = container.querySelectorAll(".mx_item");
            expectTabIndex(items[0], "0"); // Should still be on first item
            expectTabIndex(items[2], "-1"); // Should not have moved to third item

            // Test normal ArrowDown without modifiers - SHOULD navigate
            fireEvent.keyDown(container, { code: "ArrowDown" });

            items = container.querySelectorAll(".mx_item");
            expectTabIndex(items[0], "-1"); // Should have moved from first item
            expectTabIndex(items[2], "0"); // Should have moved to third item (skipping separator)
        });

        it("should skip non-focusable items when navigating down", () => {
            // Create items where every other item is not focusable
            const mixedItems: TestItemWithSeparator[] = [
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

            renderListWithHeight({ items: mixedItems });
            const container = screen.getByRole("grid");

            fireEvent.focus(container);
            navigateToFirstItem(container);
            fireEvent.keyDown(container, { code: "ArrowDown" });

            // Verify it skipped the non-focusable item at index 1
            // and went directly to the focusable item at index 2
            const items = container.querySelectorAll(".mx_item");
            expectTabIndex(items[2], "0"); // Item 3 is focused
            expectTabIndex(items[0], "-1"); // Item 1 is not focused
            expectTabIndex(items[1], "-1"); // Item 2 (non-focusable) is not focused
        });

        it("should skip non-focusable items when navigating up", () => {
            const mixedItems: TestItemWithSeparator[] = [
                { id: "1", name: "Item 1", isFocusable: true },
                SEPARATOR_ITEM,
                { id: "2", name: "Item 2", isFocusable: false },
                { id: "3", name: "Item 3", isFocusable: true },
            ];

            mockIsItemFocusable.mockImplementation((item: TestItemWithSeparator) => {
                if (item === SEPARATOR_ITEM) return false;
                return (item as TestItem).isFocusable !== false;
            });

            renderListWithHeight({ items: mixedItems });
            const container = screen.getByRole("grid");

            // Focus and go to last item first, then navigate up
            fireEvent.focus(container);
            fireEvent.keyDown(container, { code: "End" });
            fireEvent.keyDown(container, { code: "ArrowUp" });

            // Verify it skipped non-focusable items and went to the first focusable item.
            // For grouped lists the header sits above the first item, so ArrowUp from
            // Item 2 (skipping the non-focusable entries) lands on Item 1.
            const items = container.querySelectorAll(".mx_item");
            expectTabIndex(items[0], "0"); // Item 1 is focused
            expectTabIndex(items[3], "-1"); // Item 3 is not focused anymore
        });
    });

    describe("Focus Management", () => {
        it("should focus first navigable element when list gains focus for the first time", () => {
            renderListWithHeight();
            const container = screen.getByRole("grid");

            // Initial focus should go to first navigable element
            fireEvent.focus(container);

            // Verify first navigable element gets focus
            const allNav = container.querySelectorAll(variant.navigableSelector);
            expectTabIndex(allNav[0], "0");
            // Other navigable elements should not be focused
            for (let i = 1; i < allNav.length; i++) {
                expectTabIndex(allNav[i], "-1");
            }
        });

        it("should restore last focused item when regaining focus", () => {
            renderListWithHeight();
            const container = screen.getByRole("grid");

            // Focus and navigate to simulate previous usage
            fireEvent.focus(container);
            navigateToFirstItem(container);
            fireEvent.keyDown(container, { code: "ArrowDown" });

            // Verify item 2 is focused (ArrowDown skips separator)
            let items = container.querySelectorAll(".mx_item");
            expectTabIndex(items[2], "0");

            // Simulate blur by focusing elsewhere
            fireEvent.blur(container);

            // Regain focus should restore last position
            fireEvent.focus(container);

            // Verify focus is restored to the previously focused item
            items = container.querySelectorAll(".mx_item");
            expectTabIndex(items[2], "0"); // Should still be item 2
        });

        it("should not interfere with focus if item is already focused", () => {
            renderListWithHeight();
            const container = screen.getByRole("grid");

            // Focus once
            fireEvent.focus(container);

            // Focus again when already focused
            fireEvent.focus(container);

            expect(container).toBeDefined();
        });

        it("should not scroll to top when clicking an item after manual scroll", async () => {
            vi.useFakeTimers();
            // Create a larger list to enable meaningful scrolling
            const largerItems: TestItemWithSeparator[] = Array.from({ length: 50 }, (_, i) => ({
                id: `item-${i}`,
                name: `Item ${i}`,
            }));

            const mockOnClick = vi.fn();

            variant.setupClickTestMock(mockGetItemComponent, mockOnClick, () => currentItems);

            const { container } = renderListWithHeight({ items: largerItems });
            const listContainer = screen.getByRole("grid");

            // Step 1: Focus the list initially and navigate to the first regular item
            fireEvent.focus(listContainer);
            navigateToFirstItem(listContainer);

            // Verify first item is focused and tabIndexKey is set to first item
            let items = container.querySelectorAll(".mx_item");
            expectTabIndex(items[0], "0");
            expectAttribute(items[0], "data-testid", "row-0");

            // Step 2: Simulate manual scrolling (mouse wheel, scroll bar drag, etc.)
            fireEvent.scroll(listContainer, { target: { scrollTop: 300 } });
            await act(async () => {
                vi.advanceTimersByTime(200);
                await Promise.resolve();
            });

            // Step 3: After scrolling, different items should now be visible
            // but tabIndexKey should still point to "item-0" (which is no longer visible)
            items = container.querySelectorAll(".mx_item");

            // Verify that item-0 is no longer in the DOM (because it's scrolled out of view)
            const item0 = container.querySelector("[data-testid='row-0']");
            expect(item0).toBeNull();

            // Find a visible item to click on (should be items from further down the list)
            const visibleItems = container.querySelectorAll(".mx_item");
            expect(visibleItems.length).toBeGreaterThan(0);
            const clickTargetItem = visibleItems[0];

            // Click on the visible item
            fireEvent.click(clickTargetItem);
            // The click should trigger the onFocus callback, which updates the tabIndexKey
            // This simulates the real user interaction where clicking an item focuses it
            fireEvent.focus(clickTargetItem);

            // Verify the click was handled
            expect(mockOnClick).toHaveBeenCalled();

            // With the fix applied: the clicked item should become focused (tabindex="0")
            // This validates that the fix prevents unwanted scrolling back to the top
            expectTabIndex(clickTargetItem, "0");

            // The key validation: ensure we haven't scrolled back to the top
            // item-0 should still not be visible (if the fix is working)
            const item0AfterClick = container.querySelector("[data-testid='row-0']");
            expect(item0AfterClick).toBeNull();

            vi.useRealTimers();
        });
    });

    describe("Group header keyboard navigation", () => {
        // These tests only exercise meaningful behaviour for the grouped variant;
        // for the flat variant they degenerate to basic navigation assertions.
        it("should navigate from first navigable element to the first item with ArrowDown", () => {
            renderListWithHeight();
            const container = screen.getByRole("grid");

            fireEvent.focus(container);
            navigateToFirstItem(container);

            const items = container.querySelectorAll(".mx_item");
            expectTabIndex(items[0], "0");
        });

        it("should navigate back to the first navigable element with ArrowUp from the first item", () => {
            renderListWithHeight();
            const container = screen.getByRole("grid");

            fireEvent.focus(container);
            navigateToFirstItem(container);
            // Now press ArrowUp to go back before the first item
            fireEvent.keyDown(container, { code: "ArrowUp" });

            const allNav = container.querySelectorAll(variant.navigableSelector);
            expectTabIndex(allNav[0], "0");
        });
    });

    describe("Accessibility", () => {
        it("should set correct ARIA attributes", () => {
            renderListWithHeight();
            const container = screen.getByRole("grid");

            expectAttribute(container, "role", "grid");
            expectAttribute(container, "aria-rowcount", "4");
            expectAttribute(container, "aria-colcount", "1");
        });

        it("should update aria-rowcount when items change", () => {
            const { rerender } = renderListWithHeight();
            let container = screen.getByRole("grid");
            expectAttribute(container, "aria-rowcount", "4");

            const fewerItems: TestItemWithSeparator[] = [
                { id: "1", name: "Item 1" },
                { id: "2", name: "Item 2" },
            ];
            rerender(getListComponent(fewerItems));

            container = screen.getByRole("grid");
            expectAttribute(container, "aria-rowcount", "2");
        });

        it("should handle custom ARIA label", () => {
            renderListWithHeight({ "aria-label": "Custom list label" });
            const container = screen.getByRole("grid");

            expectAttribute(container, "aria-label", "Custom list label");
        });
    });

    describe("Focus preservation during keyboard navigation", () => {
        /**
         * Renders a 50-item list using real Virtuoso (no mock context) inside a
         * fixed-height container.  Because the tests run in real Chromium,
         * Virtuoso will measure the viewport, virtualise items, and honour
         * scrollIntoView calls exactly as it does in production.
         */
        const ITEM_HEIGHT = 52;
        const VIEWPORT_HEIGHT = 400;

        const renderRealVirtualizedList = (
            extraProps: Partial<FlatVirtualizedListProps<TestItemWithSeparator, any>> = {},
        ): ReturnType<typeof render> => {
            const largeItems: TestItemWithSeparator[] = Array.from({ length: 50 }, (_, i) => ({
                id: `item-${i}`,
                name: `Item ${i}`,
            }));

            mockIsItemFocusable.mockReturnValue(true);

            mockGetItemComponent.mockImplementation(
                (
                    index: number,
                    item: TestItemWithSeparator,
                    context: any,
                    onFocus: (item: TestItemWithSeparator, e: React.FocusEvent) => void,
                ) => {
                    const itemKey = typeof item === "string" ? item : item.id;
                    const isFocused = context.tabIndexKey === itemKey;
                    return (
                        <button
                            type="button"
                            className="mx_item"
                            data-testid={`row-${index}`}
                            tabIndex={isFocused ? 0 : -1}
                            role="gridcell"
                            style={{ height: `${ITEM_HEIGHT}px`, display: "block", width: "100%" }}
                            onFocus={(e) => onFocus(item, e)}
                        >
                            {item === SEPARATOR_ITEM ? "---" : (item as TestItem).name}
                        </button>
                    );
                },
            );

            return render(
                <FlatVirtualizedList
                    items={largeItems}
                    getItemComponent={mockGetItemComponent}
                    isItemFocusable={mockIsItemFocusable}
                    getItemKey={(item) => (typeof item === "string" ? item : item.id)}
                    role="grid"
                    style={{ height: `${VIEWPORT_HEIGHT}px` }}
                    fixedItemHeight={ITEM_HEIGHT}
                    {...extraProps}
                />,
            );
        };

        it("should scroll down through many items with ArrowDown and virtualise earlier items out of the DOM", async () => {
            const { container } = renderRealVirtualizedList();
            const listContainer = screen.getByRole("grid");

            // Wait for Virtuoso to finish its initial render.
            await waitFor(() => {
                expect(screen.getByTestId("row-0")).toBeDefined();
            });

            fireEvent.focus(listContainer);

            const TARGET_INDEX = 20;

            // Press ArrowDown many times — each press calls scrollIntoView which
            // makes Virtuoso scroll and re-virtualise automatically.
            for (let i = 0; i < TARGET_INDEX; i++) {
                await act(async () => {
                    fireEvent.keyDown(listContainer, { code: "ArrowDown" });
                });
            }

            // The focused item should be item-20.
            await waitFor(() => {
                const focused = Array.from(container.querySelectorAll(".mx_item")).find(
                    (el) => el.getAttribute("tabindex") === "0",
                );
                expect(focused).toBeDefined();
                expect(focused!.textContent).toBe(`Item ${TARGET_INDEX}`);
            });

            // The first item should have been virtualised out of the DOM.
            expect(container.querySelector("[data-testid='row-0']")).toBeNull();
        });

        it("should move focus from a focused child element to the scroller on keyboard navigation", async () => {
            renderRealVirtualizedList();
            const listContainer = screen.getByRole("grid");

            // Wait for Virtuoso to finish its initial render.
            await waitFor(() => {
                expect(screen.getByTestId("row-0")).toBeDefined();
            });

            // Directly focus a child button (not the scroller itself).
            // This simulates a user clicking/tabbing into a button inside the list.
            const firstButton = screen.getByTestId("row-0");
            await act(async () => {
                firstButton.focus();
            });

            // Verify the child button has DOM focus, not the scroller.
            expect(document.activeElement).toBe(firstButton);
            expect(document.activeElement).not.toBe(listContainer);

            // Press ArrowDown — the handler should detect that a child element
            // has focus and move it to the scroller before scrolling, so that
            // Virtuoso unmounting the child doesn't send focus to <body>.
            await act(async () => {
                fireEvent.keyDown(listContainer, { code: "ArrowDown" });
            });

            // After the keyDown, focus should have moved to the scroller element
            // (not remain on the child button, and not escape to <body>).
            expect(document.activeElement).toBe(listContainer);
        });

        it("should update focus to the last visible item after manual scroll when enabled", async () => {
            const { container } = renderRealVirtualizedList({ scrollSettleFocusBehavior: "last-visible" });
            const listContainer = screen.getByRole("grid");

            await waitFor(() => {
                expect(screen.getByTestId("row-0")).toBeDefined();
            });

            fireEvent.focus(listContainer);

            await act(async () => {
                fireEvent.scroll(listContainer, { target: { scrollTop: 300 } });
            });

            await waitFor(() => {
                const focused = Array.from(container.querySelectorAll(".mx_item")).find(
                    (el) => el.getAttribute("tabindex") === "0",
                );
                expect(focused).toBeDefined();
                const visibleItems = container.querySelectorAll(".mx_item");
                expect(focused).toBe(visibleItems[visibleItems.length - 1]);
            });

            expect(container.querySelector("[data-testid='row-0']")).toBeNull();
        });

        it("should scroll up through many items with ArrowUp and virtualise later items out of the DOM", async () => {
            const { container } = renderRealVirtualizedList();
            const listContainer = screen.getByRole("grid");

            await waitFor(() => {
                expect(screen.getByTestId("row-0")).toBeDefined();
            });

            fireEvent.focus(listContainer);

            // First navigate down to item-30.
            for (let i = 0; i < 30; i++) {
                await act(async () => {
                    fireEvent.keyDown(listContainer, { code: "ArrowDown" });
                });
            }

            await waitFor(() => {
                const focused = Array.from(container.querySelectorAll(".mx_item")).find(
                    (el) => el.getAttribute("tabindex") === "0",
                );
                expect(focused!.textContent).toBe("Item 30");
            });

            // Now navigate back up 20 times to item-10.
            for (let i = 0; i < 20; i++) {
                await act(async () => {
                    fireEvent.keyDown(listContainer, { code: "ArrowUp" });
                });
            }

            // The focused item should be item-10.
            await waitFor(() => {
                const focused = Array.from(container.querySelectorAll(".mx_item")).find(
                    (el) => el.getAttribute("tabindex") === "0",
                );
                expect(focused).toBeDefined();
                expect(focused!.textContent).toBe("Item 10");
            });

            // Items near the bottom (e.g. item-30) should have been virtualised out.
            expect(container.querySelector("[data-testid='row-30']")).toBeNull();
        });
    });
});

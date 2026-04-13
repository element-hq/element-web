/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ListRange, type VirtuosoHandle, type VirtuosoProps } from "react-virtuoso";

const EMPTY_CONTEXT: Record<string, never> = {};

/**
 * Keyboard key codes
 */
export const Key = {
    ARROW_UP: "ArrowUp",
    ARROW_DOWN: "ArrowDown",
    HOME: "Home",
    END: "End",
    PAGE_UP: "PageUp",
    PAGE_DOWN: "PageDown",
    ENTER: "Enter",
    SPACE: "Space",
} as const;

/**
 * Check if a keyboard event includes modifier keys
 */
export function isModifiedKeyEvent(event: React.KeyboardEvent): boolean {
    return event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
}

/**
 * Context object passed to each list item containing the currently focused key
 * and any additional context data from the parent component.
 */
export type VirtualizedListContext<Context> = {
    /** The key of item that should have tabIndex == 0 */
    tabIndexKey?: string;
    /** Whether an item in the list is currently focused */
    focused: boolean;
    /** Additional context data passed from the parent component */
    context: Context;
};

export interface VirtualizedListProps<Item, Context> extends Omit<
    VirtuosoProps<Item, VirtualizedListContext<Context>>,
    "data" | "itemContent" | "context"
> {
    /**
     * Controls whether scroll settling should update the roving focus target.
     * Defaults to "none" so existing VirtualizedList consumers keep sticky focus.
     */
    scrollSettleFocusBehavior?: "none" | "last-visible";

    /**
     * The array of items to display in the virtualized list.
     * Each item will be passed to getItemComponent for rendering.
     */
    items: Item[];

    /**
     * Optional additional context data to pass to each rendered item.
     * This will be available in the VirtualizedListContext passed to getItemComponent.
     */
    context?: Context;

    /**
     * Function to determine if an item can receive focus during keyboard navigation.
     * @param item - The item to check for focusability
     * @returns true if the item can be focused, false otherwise
     */
    isItemFocusable: (item: Item) => boolean;

    /**
     * Function to get the key to use for focusing an item.
     * @param item - The item to get the key for
     * @return The key to use for focusing the item
     */
    getItemKey: (item: Item) => string;

    /**
     * Callback function to handle key down events on the list container.
     * List handles keyboard navigation for focus(up, down, home, end, pageUp, pageDown)
     * and stops propagation otherwise the event bubbles and this callback is called for the use of the parent.
     * @param e - The keyboard event
     * @returns
     */
    onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;

    /**
     * Optional total count of items (for virtualization with partial data loading).
     * If provided, this will be used instead of items.length for the total count.
     */
    totalCount?: number;

    /**
     * Optional callback when the visible range of items changes.
     * Useful for loading data on-demand as the user scrolls.
     * @param range - The new visible range with startIndex and endIndex
     */
    rangeChanged?: (range: ListRange) => void;

    /**
     * Optional function to map from the items array index to the scroll index
     * used by virtuoso's scrollIntoView. This is needed when the items array
     * contains entries (such as group headers) that don't have a direct 1:1
     * mapping with virtuoso's own item indices.
     *
     * @param itemsIndex - The index in the items array
     * @returns The index to pass to virtuoso's scrollIntoView
     */
    mapScrollIndex?: (itemsIndex: number) => number;

    /**
     * Optional function to map from virtuoso's reported visible-range indices
     * back to the items array indices. This is needed when virtuoso reports
     * ranges in a different index space than the items array (e.g., in
     * GroupedVirtuoso where group headers are not counted in the range).
     *
     * @param virtuosoIndex - The index reported by virtuoso's rangeChanged
     * @returns The corresponding index in the items array
     */
    mapRangeIndex?: (virtuosoIndex: number) => number;
}

/**
 * Utility type for the prop scrollIntoViewOnChange allowing it to be memoised by a caller without repeating types
 */
export type ScrollIntoViewOnChange<Item, Context> = NonNullable<
    VirtuosoProps<Item, VirtualizedListContext<Context>>["scrollIntoViewOnChange"]
>;

export interface UseVirtualizedListResult<Item, Context> extends Omit<
    VirtuosoProps<Item, VirtualizedListContext<Context>>,
    "data" | "itemContent" | "context" | "onKeyDown" | "onFocus" | "onBlur" | "rangeChanged" | "scrollerRef" | "ref"
> {
    ref: React.RefObject<VirtuosoHandle | null>;
    scrollerRef: (element: HTMLElement | Window | null) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
    onFocus: (e: React.FocusEvent) => void;
    onBlur: (event: React.FocusEvent<HTMLDivElement>) => void;
    rangeChanged: (range: ListRange) => void;
    onFocusForGetItemComponent: (item: Item, e: React.FocusEvent) => void;
    context: VirtualizedListContext<Context>;
}

/**
 * A hook that provides keyboard navigation and focus management for a virtualized list
 * built on top of react-virtuoso.
 *
 * Handles Arrow Up/Down, Home, End, Page Up/Down key navigation, focus tracking via
 * a roving `tabIndex`, and automatic scrolling to keep the focused item visible.
 *
 * Returns props to spread onto a Virtuoso component along with an `onFocusForGetItemComponent`
 * callback that each item must call on focus to keep the focus state in sync.
 *
 * @param props - The virtualized list configuration including items, focusability checks,
 *                key extraction, and any pass-through Virtuoso props.
 * @returns An object of props to wire up to a Virtuoso component, plus `onFocusForGetItemComponent`
 *          for individual item focus handling.
 */
export function useVirtualizedList<Item, Context>(
    props: VirtualizedListProps<Item, Context>,
): UseVirtualizedListResult<Item, Context> {
    const SCROLL_SETTLE_DELAY_MS = 150;
    // Extract our custom props to avoid conflicts with Virtuoso props
    const {
        items,
        isItemFocusable,
        getItemKey,
        context,
        onKeyDown,
        totalCount,
        rangeChanged,
        mapScrollIndex,
        mapRangeIndex,
        scrollSettleFocusBehavior = "none",
        ...virtuosoProps
    } = props;
    /** Reference to the Virtuoso component for programmatic scrolling */
    const virtuosoHandleRef = useRef<VirtuosoHandle>(null);
    /** Reference to the DOM element containing the virtualized list */
    const virtuosoDomRef = useRef<HTMLElement | Window>(null);
    /** Track the active HTMLElement scroller so effects follow node replacement. */
    const [scrollerElement, setScrollerElement] = useState<HTMLElement | null>(null);
    /** Key of the item that should have tabIndex == 0 */
    const [tabIndexKey, setTabIndexKey] = useState<string | undefined>(
        props.items[0] ? getItemKey(props.items[0]) : undefined,
    );
    /** Range of currently visible items in the viewport */
    const visibleRangeRef = useRef<ListRange | undefined>(undefined);
    /** Map from item keys to their indices in the items array */
    const keyToIndexMap = useMemo(() => {
        const map = new Map<string, number>();
        items.forEach((item, index) => map.set(getItemKey(item), index));
        return map;
    }, [items, getItemKey]);
    const [isFocused, setIsFocused] = useState<boolean>(false);
    const pendingViewportFocusCommitRef = useRef<boolean>(false);
    const scrollSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Ensure the tabIndexKey is set if there is none already or if the existing key is no longer displayed
    useEffect(() => {
        if (items.length && (!tabIndexKey || keyToIndexMap.get(tabIndexKey) === undefined)) {
            setTabIndexKey(getItemKey(items[0]));
        }
    }, [items, getItemKey, tabIndexKey, keyToIndexMap]);

    /**
     * Scrolls to a specific item index and sets it as focused.
     * Updates tabIndexKey immediately so the UI reflects the new focus
     * synchronously, then asks Virtuoso to scroll the item into view.
     */
    const scrollToIndex = useCallback(
        (index: number, align?: "center" | "end" | "start", updateFocus = true): void => {
            // Ensure index is within bounds
            const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
            if (items[clampedIndex]) {
                const key = getItemKey(items[clampedIndex]);
                if (updateFocus) {
                    setTabIndexKey(key);
                }
                const scrollIndex = mapScrollIndex ? mapScrollIndex(clampedIndex) : clampedIndex;
                virtuosoHandleRef.current?.scrollIntoView({
                    index: scrollIndex,
                    align: align,
                    behavior: "auto",
                });
            }
        },
        [items, getItemKey, mapScrollIndex],
    );

    const commitFocusToLastVisibleItem = useCallback(
        (range: ListRange | undefined = visibleRangeRef.current): void => {
            if (!range) {
                return;
            }

            const start = Math.max(0, range.startIndex);
            const end = Math.min(range.endIndex, items.length - 1);

            for (let index = end; index >= start; index -= 1) {
                const item = items[index];
                if (item && isItemFocusable(item)) {
                    setTabIndexKey(getItemKey(item));
                    return;
                }
            }
        },
        [getItemKey, isItemFocusable, items],
    );

    /**
     * Scrolls to an item, skipping over non-focusable items if necessary.
     * This is used for keyboard navigation to ensure focus lands on valid items.
     */
    const scrollToItem = useCallback(
        (index: number, isDirectionDown: boolean, align?: "center" | "end" | "start"): void => {
            const totalRows = items.length;
            let nextIndex: number | undefined;

            for (let i = index; isDirectionDown ? i < totalRows : i >= 0; i = i + (isDirectionDown ? 1 : -1)) {
                if (isItemFocusable(items[i])) {
                    nextIndex = i;
                    break;
                }
            }

            if (nextIndex === undefined) {
                return;
            }

            scrollToIndex(nextIndex, align);
        },
        [scrollToIndex, items, isItemFocusable],
    );

    /**
     * Handles keyboard navigation for the list.
     * Supports Arrow keys, Home, End, Page Up/Down, Enter, and Space.
     */
    const keyDownCallback = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            const currentIndex = tabIndexKey ? keyToIndexMap.get(tabIndexKey) : undefined;
            const visibleRange = visibleRangeRef.current;
            let handled = false;

            // Guard against null/undefined events and modified keys which we don't want to handle here but do
            // at the settings level shortcuts(E.g. Select next room, etc )
            // Guard against null/undefined events and modified keys
            if (!e || isModifiedKeyEvent(e)) {
                onKeyDown?.(e);
                return;
            }

            if (e.code === Key.ARROW_UP && currentIndex !== undefined) {
                scrollToItem(currentIndex - 1, false);
                handled = true;
            } else if (e.code === Key.ARROW_DOWN && currentIndex !== undefined) {
                scrollToItem(currentIndex + 1, true);
                handled = true;
            } else if (e.code === Key.HOME) {
                scrollToIndex(0);
                handled = true;
            } else if (e.code === Key.END) {
                scrollToIndex(items.length - 1);
                handled = true;
            } else if (e.code === Key.PAGE_DOWN && visibleRange && currentIndex !== undefined) {
                const numberDisplayed = visibleRange.endIndex - visibleRange.startIndex;
                const targetIndex = Math.min(currentIndex + numberDisplayed, items.length - 1);
                const targetAlreadyVisible =
                    targetIndex >= visibleRange.startIndex && targetIndex <= visibleRange.endIndex;
                if (targetAlreadyVisible) {
                    scrollToIndex(targetIndex, "start", false);
                    commitFocusToLastVisibleItem(visibleRange);
                } else {
                    pendingViewportFocusCommitRef.current = true;
                    scrollToIndex(targetIndex, "start", false);
                }
                handled = true;
            } else if (e.code === Key.PAGE_UP && visibleRange && currentIndex !== undefined) {
                const numberDisplayed = visibleRange.endIndex - visibleRange.startIndex;
                const targetIndex = Math.max(currentIndex - numberDisplayed, 0);
                const targetAlreadyVisible =
                    targetIndex >= visibleRange.startIndex && targetIndex <= visibleRange.endIndex;
                if (targetAlreadyVisible) {
                    scrollToIndex(targetIndex, "start", false);
                    commitFocusToLastVisibleItem(visibleRange);
                } else {
                    pendingViewportFocusCommitRef.current = true;
                    scrollToIndex(targetIndex, "start", false);
                }
                handled = true;
            }

            if (handled) {
                // If a child element (e.g. a button) currently has DOM focus rather than the
                // scroller itself, move focus to the scroller before the scroll takes effect.
                // Without this, when Virtuoso unmounts the focused child because it has been
                // scrolled out of the visible range, the browser moves focus to <body> and
                // subsequent keyboard events no longer reach this handler.
                if (virtuosoDomRef.current instanceof HTMLElement) {
                    const activeEl = document.activeElement;
                    if (activeEl && activeEl !== virtuosoDomRef.current && virtuosoDomRef.current.contains(activeEl)) {
                        virtuosoDomRef.current.focus({ preventScroll: true });
                    }
                }
                e.stopPropagation();
                e.preventDefault();
            } else {
                onKeyDown?.(e);
            }
        },
        [commitFocusToLastVisibleItem, scrollToIndex, scrollToItem, tabIndexKey, keyToIndexMap, items, onKeyDown],
    );

    /**
     * Callback ref for the Virtuoso scroller element.
     * Stores the reference for use in focus management.
     */
    const scrollerRef = useCallback((element: HTMLElement | Window | null) => {
        virtuosoDomRef.current = element;
        const nextScrollerElement = element instanceof HTMLElement ? element : null;
        setScrollerElement((currentElement) =>
            currentElement === nextScrollerElement ? currentElement : nextScrollerElement,
        );
    }, []);

    useEffect(() => {
        if (!scrollerElement) {
            return;
        }

        const clearScrollSettleTimeout = (): void => {
            if (scrollSettleTimeoutRef.current !== null) {
                globalThis.clearTimeout(scrollSettleTimeoutRef.current);
                scrollSettleTimeoutRef.current = null;
            }
        };

        const onScroll = (): void => {
            if (scrollSettleFocusBehavior === "none") {
                return;
            }
            clearScrollSettleTimeout();
            scrollSettleTimeoutRef.current = globalThis.setTimeout(() => {
                commitFocusToLastVisibleItem();
                scrollSettleTimeoutRef.current = null;
            }, SCROLL_SETTLE_DELAY_MS);
        };

        scrollerElement.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            clearScrollSettleTimeout();
            scrollerElement.removeEventListener("scroll", onScroll);
        };
    }, [commitFocusToLastVisibleItem, scrollSettleFocusBehavior, scrollerElement]);

    /**
     * Focus handler passed to each item component.
     * Don't declare inside getItemComponent to avoid re-creating on each render.
     */
    const onFocusForGetItemComponent = useCallback(
        (item: Item, e: React.FocusEvent) => {
            // If one of the item components has been focused directly, set the focused and tabIndex state
            // and stop propagation so the List's onFocus doesn't also handle it.
            const key = getItemKey(item);
            setIsFocused(true);
            setTabIndexKey(key);
            e.stopPropagation();
        },
        [getItemKey],
    );

    /**
     * Handles focus events on the list.
     * Sets the focused state and scrolls to the focused item if it is not currently visible.
     */
    const onFocus = useCallback(
        (e: React.FocusEvent): void => {
            if (e?.currentTarget !== virtuosoDomRef.current || typeof tabIndexKey !== "string") {
                return;
            }

            setIsFocused(true);
            const index = keyToIndexMap.get(tabIndexKey);
            const visibleRange = visibleRangeRef.current;
            if (
                index !== undefined &&
                visibleRange &&
                (index < visibleRange.startIndex || index > visibleRange.endIndex)
            ) {
                scrollToIndex(index);
            }
            e.stopPropagation();
            e.preventDefault();
        },
        [keyToIndexMap, scrollToIndex, tabIndexKey],
    );

    const onBlur = useCallback((event: React.FocusEvent<HTMLDivElement>): void => {
        // Only set isFocused to false if the focus is moving outside the list
        // This prevents the list from losing focus when interacting with menus inside it
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsFocused(false);
        }
    }, []);

    const listContext: VirtualizedListContext<Context> = useMemo(
        () => ({
            tabIndexKey: tabIndexKey,
            focused: isFocused,
            context: (context ?? EMPTY_CONTEXT) as Context,
        }),
        [tabIndexKey, isFocused, context],
    );

    // Combine internal range tracking with optional external callback
    const handleRangeChanged = useCallback(
        (range: ListRange) => {
            const internalRange = mapRangeIndex
                ? { startIndex: mapRangeIndex(range.startIndex), endIndex: mapRangeIndex(range.endIndex) }
                : range;
            visibleRangeRef.current = internalRange;
            if (pendingViewportFocusCommitRef.current) {
                commitFocusToLastVisibleItem(internalRange);
                pendingViewportFocusCommitRef.current = false;
            }
            rangeChanged?.(internalRange);
        },
        [commitFocusToLastVisibleItem, rangeChanged, mapRangeIndex],
    );

    return {
        ...virtuosoProps,
        totalCount,
        ref: virtuosoHandleRef,
        scrollerRef,
        onKeyDown: keyDownCallback,
        onFocus,
        onBlur,
        rangeChanged: handleRangeChanged,
        onFocusForGetItemComponent,
        context: listContext,
    };
}

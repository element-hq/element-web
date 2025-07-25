/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useRef, type JSX, useCallback } from "react";
import { type VirtuosoHandle, type ListRange, Virtuoso, type VirtuosoProps } from "react-virtuoso";

/**
 * Context object passed to each list item containing the currently focused index
 * and any additional context data from the parent component.
 */
export type ListContext<Context> = {
    /** The index of the currently focused item in the list (-1 if no item is focused) */
    focusedIndex: number;
    /** Additional context data passed from the parent component */
    context: Context;
};

export interface IListViewProps<Item, Context>
    extends Omit<VirtuosoProps<Item, ListContext<Context>>, "data" | "itemContent" | "context"> {
    /**
     * The array of items to display in the virtualized list.
     * Each item will be passed to getItemComponent for rendering.
     */
    items: Item[];

    /**
     * Callback function called when an item is selected (via Enter/Space key).
     * @param item - The selected item from the items array
     */
    onSelectItem: (item: Item) => void;

    /**
     * Function that renders each list item as a JSX element.
     * @param index - The index of the item in the list
     * @param item - The data item to render
     * @param context - The context object containing the focused index and any additional data
     * @param onBlur - Callback to call when the item loses focus
     * @returns JSX element representing the rendered item
     */
    getItemComponent: (index: number, item: Item, context: ListContext<Context>, onBlur: () => void) => JSX.Element;

    /**
     * Optional additional context data to pass to each rendered item.
     * This will be available in the ListContext passed to getItemComponent.
     */
    context?: Context;

    /**
     * Optional function to determine if an item can receive focus during keyboard navigation.
     * If not provided, all items are considered focusable.
     * @param item - The item to check for focusability
     * @returns true if the item can be focused, false otherwise
     */
    isItemFocusable?: (item: Item) => boolean;
}

/**
 * A generic virtualized list component built on top of react-virtuoso.
 * Provides keyboard navigation and virtualized rendering for performance with large lists.
 *
 * @template Item - The type of data items in the list
 * @template Context - The type of additional context data passed to items
 */
export function ListView<Item, Context = any>(props: IListViewProps<Item, Context>): React.ReactElement {
    /** Reference to the Virtuoso component for programmatic scrolling */
    const virtusoHandleRef = useRef<VirtuosoHandle | null>(null);
    /** Reference to the DOM element containing the virtualized list */
    const virtusoDomRef = useRef<HTMLElement | Window | null>(null);
    /** Index of the currently focused item (-1 if no item is focused) */
    const [focusedIndex, setFocusedIndex] = React.useState(-1);
    /** Index of the last focused item (used when regaining focus) */
    const [lastFocusedIndex, setLastFocusedIndex] = React.useState(-1);
    /** Range of currently visible items in the viewport */
    const [visibleRange, setVisibleRange] = React.useState<ListRange | undefined>(undefined);

    // Extract our custom props to avoid conflicts with Virtuoso props
    const { items, onSelectItem, getItemComponent, isItemFocusable, context, ...virtuosoProps } = props;

    /**
     * Wrapper function that renders each list item and provides the onBlur callback.
     * This function is called by Virtuoso for each visible item.
     */
    const getItemComponentInternal = useCallback(
        (index: number, item: Item, context: ListContext<Context>): JSX.Element => {
            const onBlur = (): void => {
                if (focusedIndex == index) {
                    setFocusedIndex(-1);
                    setLastFocusedIndex(index);
                }
            };
            return getItemComponent(index, item, context, onBlur);
        },
        [focusedIndex, getItemComponent],
    );

    /**
     * Scrolls to a specific item index and sets it as focused.
     * Uses Virtuoso's scrollIntoView method for smooth scrolling.
     */
    const scrollToIndex = useCallback(
        (index: number, align?: "center" | "end" | "start"): void => {
            virtusoHandleRef?.current?.scrollIntoView({
                index: index,
                align: align,
                behavior: "auto",
                done: () => {
                    setFocusedIndex(index);
                },
            });
        },
        [virtusoHandleRef],
    );

    /**
     * Scrolls to an item, skipping over non-focusable items if necessary.
     * This is used for keyboard navigation to ensure focus lands on valid items.
     */
    const scrollToItem = useCallback(
        (index: number, isDirectionDown: boolean, align?: "center" | "end" | "start"): void => {
            const totalRows = items.length;
            let nextIndex = index;

            // Skip non-focusable items until we find a focusable one or reach the bounds
            if (isItemFocusable) {
                if (isDirectionDown) {
                    // Moving down: find the next focusable item
                    while (nextIndex < totalRows - 1 && !isItemFocusable(items[nextIndex])) {
                        nextIndex++;
                    }
                    nextIndex = Math.min(totalRows - 1, nextIndex);
                } else {
                    // Moving up: find the previous focusable item
                    while (nextIndex > 0 && !isItemFocusable(items[nextIndex])) {
                        nextIndex--;
                    }
                    nextIndex = Math.max(0, nextIndex);
                }
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
        (e: React.KeyboardEvent) => {
            if (!e) return; // Guard against null/undefined events

            let handled = false;
            if (e.code === "ArrowUp") {
                scrollToItem(focusedIndex - 1, false);
                handled = true;
            } else if (e.code === "ArrowDown") {
                scrollToItem(focusedIndex + 1, true);
                handled = true;
            } else if ((e.code === "Enter" || e.code === "Space") && focusedIndex >= 0) {
                const item = items[focusedIndex];
                onSelectItem(item);
                handled = true;
            } else if (e.code === "Home") {
                scrollToIndex(0);
                handled = true;
            } else if (e.code === "End") {
                scrollToIndex(items.length - 1);
                handled = true;
            } else if (e.code === "PageDown" && visibleRange) {
                const numberDisplayed = visibleRange.endIndex - visibleRange.startIndex;
                scrollToItem(focusedIndex + numberDisplayed, false, `start`);
                handled = true;
            } else if (e.code === "PageUp" && visibleRange) {
                const numberDisplayed = visibleRange.endIndex - visibleRange.startIndex;
                scrollToItem(focusedIndex - numberDisplayed, false, `start`);
                handled = true;
            }

            if (handled) {
                e.stopPropagation();
                e.preventDefault();
            }
        },
        [scrollToIndex, scrollToItem, focusedIndex, visibleRange, items, onSelectItem],
    );

    /**
     * Callback ref for the Virtuoso scroller element.
     * Stores the reference for use in focus management.
     */
    const scrollerRef = React.useCallback((element: HTMLElement | Window | null) => {
        if (element) {
            virtusoDomRef.current = element;
        }
    }, []);

    /**
     * Handles focus events on the list.
     * Sets initial focus to the last focused item or the first item if none was previously focused.
     */
    const onFocus = (e?: React.FocusEvent): void => {
        if (e?.currentTarget !== virtusoDomRef.current || focusedIndex > -1) {
            return;
        }
        const nextIndex = lastFocusedIndex == -1 ? 0 : lastFocusedIndex;
        scrollToIndex(nextIndex);
        e.stopPropagation();
        e.preventDefault();
    };

    const listContext: ListContext<Context> = {
        focusedIndex: focusedIndex,
        context: props.context || ({} as Context),
    };

    return (
        <Virtuoso
            role="grid"
            aria-rowcount={props.items.length}
            aria-colcount={1}
            scrollerRef={scrollerRef}
            ref={virtusoHandleRef}
            onKeyDown={keyDownCallback}
            context={listContext}
            rangeChanged={setVisibleRange}
            overscan={props.overscan}
            data={props.items}
            onFocus={onFocus}
            itemContent={getItemComponentInternal}
            {...virtuosoProps}
        />
    );
}

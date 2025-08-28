/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useRef, type JSX, useCallback, useEffect, useState } from "react";
import { type VirtuosoHandle, type ListRange, Virtuoso, type VirtuosoProps } from "react-virtuoso";

import { isModifiedKeyEvent, Key } from "../../Keyboard";
/**
 * Context object passed to each list item containing the currently focused key
 * and any additional context data from the parent component.
 */
export type ListContext<Context> = {
    /** The key of item that should have tabIndex == 0 */
    tabIndexKey?: string;
    /** Whether an item in the list is currently focused */
    focused: boolean;
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
     * Function that renders each list item as a JSX element.
     * @param index - The index of the item in the list
     * @param item - The data item to render
     * @param context - The context object containing the focused key and any additional data
     * @param onFocus - A callback that is required to be called when the item component receives focus
     * @returns JSX element representing the rendered item
     */
    getItemComponent: (
        index: number,
        item: Item,
        context: ListContext<Context>,
        onFocus: (e: React.FocusEvent) => void,
    ) => JSX.Element;

    /**
     * Optional additional context data to pass to each rendered item.
     * This will be available in the ListContext passed to getItemComponent.
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
     * ListView handles keyboard navigation for focus(up, down, home, end, pageUp, pageDown)
     * and stops propagation otherwise the event bubbles and this callback is called for the use of the parent.
     * @param e - The keyboard event
     * @returns
     */
    onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * A generic virtualized list component built on top of react-virtuoso.
 * Provides keyboard navigation and virtualized rendering for performance with large lists.
 *
 * @template Item - The type of data items in the list
 * @template Context - The type of additional context data passed to items
 */
export function ListView<Item, Context = any>(props: IListViewProps<Item, Context>): React.ReactElement {
    // Extract our custom props to avoid conflicts with Virtuoso props
    const { items, getItemComponent, isItemFocusable, getItemKey, context, onKeyDown, ...virtuosoProps } = props;
    /** Reference to the Virtuoso component for programmatic scrolling */
    const virtuosoHandleRef = useRef<VirtuosoHandle>(null);
    /** Reference to the DOM element containing the virtualized list */
    const virtuosoDomRef = useRef<HTMLElement | Window>(null);
    /** Key of the item that should have tabIndex == 0 */
    const [tabIndexKey, setTabIndexKey] = useState<string | undefined>(
        props.items[0] ? getItemKey(props.items[0]) : undefined,
    );
    /** Range of currently visible items in the viewport */
    const [visibleRange, setVisibleRange] = useState<ListRange | undefined>(undefined);
    /** Map from item keys to their indices in the items array */
    const [keyToIndexMap, setKeyToIndexMap] = useState<Map<string, number>>(new Map());
    /** Whether the list is currently scrolling to an item */
    const isScrollingToItem = useRef<boolean>(false);
    /** Whether the list is currently focused */
    const [isFocused, setIsFocused] = useState<boolean>(false);

    // Update the key-to-index mapping whenever items change
    useEffect(() => {
        const newKeyToIndexMap = new Map<string, number>();
        items.forEach((item, index) => {
            const key = getItemKey(item);
            newKeyToIndexMap.set(key, index);
        });
        setKeyToIndexMap(newKeyToIndexMap);
    }, [items, getItemKey]);

    // Ensure the tabIndexKey is set if there is none already or if the existing key is no longer displayed
    useEffect(() => {
        if (items.length && (!tabIndexKey || keyToIndexMap.get(tabIndexKey) === undefined)) {
            setTabIndexKey(getItemKey(items[0]));
        }
    }, [items, getItemKey, tabIndexKey, keyToIndexMap]);

    /**
     * Scrolls to a specific item index and sets it as focused.
     * Uses Virtuoso's scrollIntoView method for smooth scrolling.
     */
    const scrollToIndex = useCallback(
        (index: number, align?: "center" | "end" | "start"): void => {
            // Ensure index is within bounds
            const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
            if (isScrollingToItem.current) {
                // If already scrolling to an item drop this request. Adding further requests
                // causes the event to bubble up and be handled by other components(unintentional timeline scrolling was observed).
                return;
            }
            if (items[clampedIndex]) {
                const key = getItemKey(items[clampedIndex]);
                setTabIndexKey(key);
                isScrollingToItem.current = true;
                virtuosoHandleRef.current?.scrollIntoView({
                    index: clampedIndex,
                    align: align,
                    behavior: "auto",
                    done: () => {
                        isScrollingToItem.current = false;
                    },
                });
            }
        },
        [items, getItemKey],
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
                scrollToItem(Math.min(currentIndex + numberDisplayed, items.length - 1), true, `start`);
                handled = true;
            } else if (e.code === Key.PAGE_UP && visibleRange && currentIndex !== undefined) {
                const numberDisplayed = visibleRange.endIndex - visibleRange.startIndex;
                scrollToItem(Math.max(currentIndex - numberDisplayed, 0), false, `start`);
                handled = true;
            }

            if (handled) {
                e.stopPropagation();
                e.preventDefault();
            } else {
                onKeyDown?.(e);
            }
        },
        [scrollToIndex, scrollToItem, tabIndexKey, keyToIndexMap, visibleRange, items, onKeyDown],
    );

    /**
     * Callback ref for the Virtuoso scroller element.
     * Stores the reference for use in focus management.
     */
    const scrollerRef = useCallback((element: HTMLElement | Window | null) => {
        virtuosoDomRef.current = element;
    }, []);

    const getItemComponentInternal = useCallback(
        (index: number, item: Item, context: ListContext<Context>): JSX.Element => {
            const onFocus = (e: React.FocusEvent): void => {
                // If one of the item components has been focused directly, set the focused and tabIndex state
                // and stop propagation so the ListViews onFocus doesn't also handle it.
                const key = getItemKey(item);
                setIsFocused(true);
                setTabIndexKey(key);
                e.stopPropagation();
            };
            return getItemComponent(index, item, context, onFocus);
        },
        [getItemComponent, getItemKey],
    );
    /**
     * Handles focus events on the list.
     * Sets the focused state and scrolls to the focused item if it is not currently visible.
     */
    const onFocus = useCallback(
        (e?: React.FocusEvent): void => {
            if (e?.currentTarget !== virtuosoDomRef.current || typeof tabIndexKey !== "string") {
                return;
            }

            setIsFocused(true);
            const index = keyToIndexMap.get(tabIndexKey);
            if (
                index !== undefined &&
                visibleRange &&
                (index < visibleRange.startIndex || index > visibleRange.endIndex)
            ) {
                scrollToIndex(index);
            }
            e?.stopPropagation();
            e?.preventDefault();
        },
        [keyToIndexMap, visibleRange, scrollToIndex, tabIndexKey],
    );

    const onBlur = useCallback((event: React.FocusEvent<HTMLDivElement>): void => {
        // Only set isFocused to false if the focus is moving outside the list
        // This prevents the list from losing focus when interacting with menus inside it
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsFocused(false);
        }
    }, []);

    const listContext: ListContext<Context> = {
        tabIndexKey: tabIndexKey,
        focused: isFocused,
        context: props.context || ({} as Context),
    };

    return (
        <Virtuoso
            tabIndex={props.tabIndex || undefined} // We don't need to focus the container, so leave it undefined by default
            ref={virtuosoHandleRef}
            scrollerRef={scrollerRef}
            onKeyDown={keyDownCallback}
            context={listContext}
            rangeChanged={setVisibleRange}
            // virtuoso errors internally if you pass undefined.
            overscan={props.overscan || 0}
            data={props.items}
            onFocus={onFocus}
            onBlur={onBlur}
            itemContent={getItemComponentInternal}
            {...virtuosoProps}
        />
    );
}

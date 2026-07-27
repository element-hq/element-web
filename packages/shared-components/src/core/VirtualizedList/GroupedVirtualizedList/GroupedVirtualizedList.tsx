/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, {
    type JSX,
    type ReactNode,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { type Components, type ListItem, Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import { useVirtualizedList, type VirtualizedListContext, type VirtualizedListProps } from "../virtualized-list";
import styles from "./GroupedVirtualizedList.module.css";

/**
 * Virtuoso row wrapper that makes section-header rows `position: sticky`, so a header pins to the
 * top and the next one slides up to cover it (and reveals the previous on the way back) — native,
 * compositor-driven cover/reveal. Room rows render in normal flow. Because Virtuoso unmounts rows
 * scrolled out of its render window, a tall section's header eventually unmounts and stops sticking;
 * the pinned overlay (rendered outside the list) backstops that gap.
 */
const StickyRowItem: Components["Item"] = React.forwardRef(function StickyRowItem(
    // `item` and `context` are Virtuoso-injected props, not DOM attributes — pull them out so they
    // aren't spread onto the div (`context` would otherwise render as `context="[object Object]"`).
    { item, context, children, ...props },
    ref,
) {
    const isHeader = item != null && typeof item === "object" && "header" in item;
    return (
        <div {...props} ref={ref as React.Ref<HTMLDivElement>} className={isHeader ? styles.stickyRow : undefined}>
            {children}
        </div>
    );
});

/**
 * A group of items for the grouped virtualized list.
 * The `header` uses a dedicated `Header` type, separate from the `Item` type
 * used for the group's child items.
 */
export interface Group<Header, Item> {
    /** The data representing this group's header. */
    header: Header;
    /** The items belonging to this group. */
    items: Item[];
}

/**
 * Internal discriminated union used to bridge the separate `Item` / `Header`
 * types into a single array that the keyboard-navigation hook can operate on.
 * Discriminated by property name: `"header" in entry` vs `"item" in entry`.
 */
type NavigationEntry<Header, Item> = { header: Header } | { item: Item };

export interface GroupedVirtualizedListProps<Header, Item, Context> extends Omit<
    VirtualizedListProps<Item, Context>,
    // `itemsRendered`, `onScroll` and `scrollPaddingTop` are owned internally to drive the pinned
    // header (see renderStickyHeader) and keep keyboard focus clear of it.
    "items" | "isItemFocusable" | "getItemKey" | "itemsRendered" | "onScroll" | "scrollPaddingTop"
> {
    /**
     * Optional ref to the underlying Virtuoso handle, for imperative scrolling.
     */
    scrollHandleRef?: React.RefCallback<VirtuosoHandle>;

    /**
     * The groups to display in the virtualized list.
     * Each group has a header and an array of child items.
     */
    groups: Group<Header, Item>[];

    /**
     * Function to get a unique key for an item.
     * @param item - The item to get the key for
     * @returns A unique key string
     */
    getItemKey: (item: Item) => string;

    /**
     * Function to get a unique key for a group header.
     * @param header - The header to get the key for
     * @returns A unique key string
     */
    getHeaderKey: (header: Header) => string;

    /**
     * Function to determine if an item can receive focus during keyboard navigation.
     * @param item - The item to check
     * @returns true if the item can be focused
     */
    isItemFocusable: (item: Item) => boolean;

    /**
     * Function to determine if a group header can receive focus during keyboard navigation.
     * @param header - The header to check
     * @returns true if the header can be focused
     */
    isGroupHeaderFocusable: (header: Header) => boolean;

    /**
     * Function that renders the group header as a JSX element.
     * @param groupIndex - The index of the group in the list
     * @param header - The header data for this group
     * @param context - The context object containing the focused key and any additional data
     * @param onFocus - A callback that must be called when the group header component receives
     *   focus. Should be invoked as `onFocus(header, e)`.
     * @returns JSX element representing the rendered group header
     */
    getGroupHeaderComponent: (
        groupIndex: number,
        header: Header,
        context: VirtualizedListContext<Context>,
        onFocus: (header: Header, e: React.FocusEvent) => void,
    ) => JSX.Element;

    /**
     * Function that renders each list item as a JSX element.
     * @param index - The index of the item in the list (relative to the entire list, not the group)
     * @param item - The data item to render
     * @param context - The context object containing the focused key and any additional data
     * @param onFocus - A callback that is required to be called when the item component receives focus
     * @param groupIndex - The index of the group this item belongs to
     * @returns JSX element representing the rendered item
     */
    getItemComponent: (
        index: number,
        item: Item,
        context: VirtualizedListContext<Context>,
        onFocus: (item: Item, e: React.FocusEvent) => void,
        groupIndex: number,
    ) => JSX.Element;

    /**
     * Optional renderer for a "pinned" header that stays fixed at the top of the scroll
     * viewport, reflecting the group the user is currently scrolled within.
     *
     * List rows — including real group headers — are virtualized and unmount once scrolled out
     * of the render window, so a CSS `position: sticky` header would disappear partway through a
     * tall group. This header is rendered OUTSIDE the virtualized stream, so it never unmounts.
     *
     * The real header rows remain the focusable, accessible elements driving keyboard navigation
     * and screen-reader output; this overlay must therefore be purely presentational and is
     * hidden from assistive technology by the caller.
     *
     * @param groupIndex - The index of the group currently pinned at the top
     * @param header - The header data for that group
     * @param context - The list context, including any additional context data
     * @returns The presentational pinned header, or `null`/`undefined` to render nothing
     */
    renderStickyHeader?: (groupIndex: number, header: Header, context: VirtualizedListContext<Context>) => ReactNode;
}

/**
 * A generic grouped virtualized list component built on top of react-virtuoso's Virtuoso.
 * Provides keyboard navigation (including group headers) and virtualized rendering for
 * performance with large lists.
 *
 * Group headers use a dedicated `Header` type, while child items use `Item`.
 * Internally, a unified flat array interleaving headers and items is built using
 * `flatMap` so that the keyboard-navigation hook can treat every focusable element
 * uniformly.
 *
 * @template Header - The type of group header data
 * @template Item - The type of data items in the list
 * @template Context - The type of additional context data passed to items
 */
export function GroupedVirtualizedList<Header, Item, Context>(
    props: GroupedVirtualizedListProps<Header, Item, Context>,
): React.ReactElement {
    const {
        getItemComponent,
        groups,
        getGroupHeaderComponent,
        isItemFocusable,
        isGroupHeaderFocusable,
        getItemKey,
        getHeaderKey,
        scrollHandleRef,
        renderStickyHeader,
        ...restProps
    } = props;

    // Measured height of the pinned overlay header. Drives both the push animation and the keyboard
    // scroll padding (so focused items land below the overlay rather than behind it). 0 = no overlay.
    const [headerHeight, setHeaderHeight] = useState(0);

    // Build a flat array interleaving group headers with items.
    // Each entry is either { header } or { item }.
    const flatEntries = useMemo(
        () =>
            groups.flatMap<NavigationEntry<Header, Item>>((group) => [
                { header: group.header },
                ...group.items.map<NavigationEntry<Header, Item>>((item) => ({
                    item,
                })),
            ]),
        [groups],
    );

    // Pre-compute a lookup from flat index to group index.
    // Each group contributes 1 header + N items, all mapped to the same group index.
    const flatIndexToGroupIndex = useMemo(
        () => groups.flatMap((group, groupIdx) => new Array(1 + group.items.length).fill(groupIdx)),
        [groups],
    );

    // Per-item top padding for keyboard scrolling: reserve the overlay height for room items (so
    // they land below the pinned header), but 0 for header items — a focused header should land at
    // the exact top, where the overlay yields to the real (focusable) header.
    const getScrollPaddingTop = useCallback(
        (index: number): number => {
            const entry = flatEntries[index];
            return entry && "header" in entry ? 0 : headerHeight;
        },
        [flatEntries, headerHeight],
    );

    // Wrap getItemKey: dispatch to getHeaderKey or getItemKey based on entry type
    const wrappedGetEntryKey = useCallback(
        (entry: NavigationEntry<Header, Item>): string =>
            "header" in entry ? getHeaderKey(entry.header) : getItemKey(entry.item),
        [getHeaderKey, getItemKey],
    );

    // Wrap isItemFocusable: headers use isGroupHeaderFocusable, items use isItemFocusable
    const wrappedIsEntryFocusable = useCallback(
        (entry: NavigationEntry<Header, Item>): boolean =>
            "header" in entry ? isGroupHeaderFocusable(entry.header) : isItemFocusable(entry.item),
        [isGroupHeaderFocusable, isItemFocusable],
    );

    const {
        onFocusForGetItemComponent,
        scrollerRef: hookScrollerRef,
        ...virtuosoProps
    } = useVirtualizedList<NavigationEntry<Header, Item>, Context>(
        {
            ...(restProps as Omit<
                VirtualizedListProps<NavigationEntry<Header, Item>, Context>,
                "items" | "isItemFocusable" | "getItemKey"
            >),
            items: flatEntries,
            isItemFocusable: wrappedIsEntryFocusable,
            getItemKey: wrappedGetEntryKey,
            // Keep keyboard-focused rooms clear of the pinned overlay header (headers get 0; see above).
            scrollPaddingTop: getScrollPaddingTop,
        },
        scrollHandleRef,
    );

    // Convert (Item, e) → (NavigationEntry, e) for regular items
    const onFocusForItem = useCallback(
        (item: Item, e: React.FocusEvent): void => {
            onFocusForGetItemComponent({ item }, e);
        },
        [onFocusForGetItemComponent],
    );

    // Convert (Header, e) → (NavigationEntry, e) for group headers
    const onFocusForHeader = useCallback(
        (header: Header, e: React.FocusEvent): void => {
            onFocusForGetItemComponent({ header }, e);
        },
        [onFocusForGetItemComponent],
    );

    // Unified item renderer that dispatches to group header or item component
    // based on the entry type at the given flat index.
    const itemContent = useCallback(
        (
            flatIndex: number,
            _entry: NavigationEntry<Header, Item>,
            context: VirtualizedListContext<Context>,
        ): JSX.Element => {
            const entry = flatEntries[flatIndex];
            const groupIndex = flatIndexToGroupIndex[flatIndex];

            if ("header" in entry) {
                return getGroupHeaderComponent(groupIndex, entry.header, context, onFocusForHeader);
            }

            // Item index in the flattened (non-header) items array:
            // flatIndex minus the number of headers before it (groupIndex + 1).
            const itemIndex = flatIndex - (groupIndex + 1);
            return getItemComponent(itemIndex, entry.item, context, onFocusForItem, groupIndex);
        },
        [
            flatEntries,
            flatIndexToGroupIndex,
            getGroupHeaderComponent,
            getItemComponent,
            onFocusForItem,
            onFocusForHeader,
        ],
    );

    // --- Pinned ("sticky") header tracking -------------------------------------------------
    // Work out which section is at the top of the viewport so the overlay can mirror it: find the
    // top-most rendered item by comparing each item's measured `offset` (from `itemsRendered`)
    // against the live `scrollTop`, then take that item's group.
    //
    // We can't use Virtuoso's reported range for this. It also counts the rows rendered off-screen
    // above the viewport (`increaseViewportBy`), so its start index sits ~a screenful too high.
    // Right after you scroll into a new section that start index is still back in the previous
    // section — so the overlay would keep showing the previous section's header until you'd
    // scrolled well into the new one.
    const renderedItemsRef = useRef<{ index: number; offset: number }[]>([]);
    const overlayRef = useRef<HTMLDivElement>(null);
    // The scroller element, held as a ref for imperative reads (`scrollTop`, while computing the
    // pinned header) and writes (wheel forwarding). A ref rather than state because mutating a
    // *state* value's `scrollTop` trips react-compiler's immutability check, and scroll updates are
    // driven by Virtuoso's `onScroll` prop — so no effect needs to re-subscribe when it mounts.
    const scrollerElRef = useRef<HTMLElement | null>(null);
    const [currentGroupIndex, setCurrentGroupIndex] = useState(0);

    // Recompute which section the overlay backstop should mirror. Runs on every scroll frame, but
    // it's cheap — it only reads scrollTop + the cached item offsets and updates a single state value.
    const updateSticky = useCallback((): void => {
        const scroller = scrollerElRef.current;
        if (!scroller || flatIndexToGroupIndex.length === 0) return;
        const scrollTop = scroller.scrollTop;
        const rendered = renderedItemsRef.current;

        // Find the top-most rendered item: the greatest measured offset that's still at or above the
        // fold (+1px rounding tolerance). Its group is the section currently at the top.
        let topIndex = rendered.length ? rendered[0].index : 0;
        let bestOffset = rendered.length ? rendered[0].offset : 0;
        for (const item of rendered) {
            if (item.offset <= scrollTop + 1 && item.offset > bestOffset) {
                bestOffset = item.offset;
                topIndex = item.index;
            }
        }

        const groupIndex = flatIndexToGroupIndex[topIndex] ?? 0;
        setCurrentGroupIndex((prev) => (prev === groupIndex ? prev : groupIndex));
    }, [flatIndexToGroupIndex]);

    // Capture the latest item offsets, then refresh the pinned header.
    const handleItemsRendered = useCallback(
        (items: ListItem<NavigationEntry<Header, Item>>[]): void => {
            renderedItemsRef.current = items.map((item) => ({ index: item.index, offset: item.offset }));
            updateSticky();
        },
        [updateSticky],
    );

    // Compose the hook's scroller ref so we can also capture the element for imperative use
    // (reading scrollTop while computing the pinned header, and forwarding wheel events).
    const handleScrollerRef = useCallback(
        (element: HTMLElement | Window | null): void => {
            hookScrollerRef?.(element);
            scrollerElRef.current = element instanceof HTMLElement ? element : null;
        },
        [hookScrollerRef],
    );

    // The overlay is interactive (so it can be clicked/hovered), which means it would otherwise
    // swallow wheel scrolling over the header strip. Forward those wheel deltas to the scroller.
    const handleOverlayWheel = useCallback((e: React.WheelEvent): void => {
        const el = scrollerElRef.current;
        if (el) el.scrollTop += e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    }, []);

    // Measure the pinned header's height (used by the keyboard scroll padding, so a focused room
    // lands clear of it) whenever it could have changed. setState bails out when unchanged.
    useLayoutEffect(() => {
        if (overlayRef.current) setHeaderHeight(overlayRef.current.offsetHeight);
    }, [currentGroupIndex, groups]);

    // Groups can change (sections added/removed/reordered); re-evaluate against the new layout.
    useEffect(() => {
        updateSticky();
    }, [groups, updateSticky]);

    const stickyGroupIndex = Math.min(currentGroupIndex, groups.length - 1);
    const stickyHeader =
        renderStickyHeader && stickyGroupIndex >= 0
            ? renderStickyHeader(stickyGroupIndex, groups[stickyGroupIndex].header, virtuosoProps.context)
            : null;

    return (
        <div className={styles.stickyRoot}>
            {stickyHeader != null && (
                <div className={styles.stickyHeader} ref={overlayRef} onWheel={handleOverlayWheel}>
                    {stickyHeader}
                </div>
            )}
            <Virtuoso
                // note that either the container of direct children must be focusable to be axe
                // compliant, so we leave tabIndex as the default so the container can be focused
                // (virtuoso wraps the children inside another couple of elements so setting it
                // on those doesn't seem to work, unfortunately)
                itemContent={itemContent}
                data={flatEntries}
                {...virtuosoProps}
                components={
                    { Item: StickyRowItem } as Components<
                        NavigationEntry<Header, Item>,
                        VirtualizedListContext<Context>
                    >
                }
                scrollerRef={handleScrollerRef}
                itemsRendered={handleItemsRendered}
                // Keep the overlay backstop's section current as you scroll. The cover/reveal
                // animation is native `position: sticky` (.stickyRow), so this only tracks which
                // section the backstop should mirror.
                onScroll={updateSticky}
            />
        </div>
    );
}

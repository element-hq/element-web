/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useCallback, useMemo, useRef, type PropsWithChildren } from "react";
import { GroupedVirtuoso } from "react-virtuoso";

import { useVirtualizedList, type VirtualizedListContext, type VirtualizedListProps } from "../virtualized-list";

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
    "items" | "isItemFocusable" | "getItemKey"
> {
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
}

/**
 * A generic grouped virtualized list component built on top of react-virtuoso's GroupedVirtuoso.
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
        ...restProps
    } = props;

    const groupCounts = useMemo(() => groups.map((group) => group.items.length), [groups]);
    const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);

    // Build a flat navigation array interleaving group headers with items.
    const flatEntries = useMemo(
        () =>
            groups.flatMap<NavigationEntry<Header, Item>>((group) => [
                { header: group.header },
                ...group.items.map<NavigationEntry<Header, Item>>((item) => ({ item })),
            ]),
        [groups],
    );

    // Build both index-mapping functions in a single pass over the flat entries.
    // mapScrollIndex: flat index → GroupedVirtuoso item index (headers map to their
    //   first item so scrollIntoView makes the sticky header visible).
    // mapRangeIndex: GroupedVirtuoso item index → flat index (translates visible-range
    //   indices back so the hook's PageUp/PageDown and focus-restore logic works).
    const { mapScrollIndex, mapRangeIndex } = useMemo(() => {
        // Map each flat index to the corresponding virtuoso item index.
        // Headers map to the first item of their group so scrollIntoView shows the sticky header.
        const flatIndexToVirtuosoIndex: number[] = [];

        // Map the Item index (from virtuoso) to their position in the flat list
        const virtuosoIndexToFlatIndex: number[] = [];
        let virtuosoIndex = 0;

        for (let i = 0; i < flatEntries.length; i++) {
            flatIndexToVirtuosoIndex.push(virtuosoIndex);

            if ("item" in flatEntries[i]) {
                virtuosoIndexToFlatIndex.push(i);
                virtuosoIndex++;
            }
        }

        return {
            mapScrollIndex: (flatIndex: number): number => flatIndexToVirtuosoIndex[flatIndex] ?? 0,
            mapRangeIndex: (virtuosoIndex: number): number => virtuosoIndexToFlatIndex[virtuosoIndex] ?? 0,
        };
    }, [flatEntries]);

    // Wrap getItemKey: dispatch to getHeaderKey or getItemKey based on entry type
    const wrappedGetEntryKey = useCallback(
        (entry: NavigationEntry<Header, Item>): string =>
            "header" in entry ? getHeaderKey(entry.header) : getItemKey(entry.item),
        [getHeaderKey, getItemKey],
    );

    // Wrap isItemFocusable: headers use isHeaderFocusable (default: always true), items use isItemFocusable
    const wrappedIsEntryFocusable = useCallback(
        (entry: NavigationEntry<Header, Item>): boolean =>
            "header" in entry ? isGroupHeaderFocusable(entry.header) : isItemFocusable(entry.item),
        [isGroupHeaderFocusable, isItemFocusable],
    );

    const { onFocusForGetItemComponent, ...virtuosoProps } = useVirtualizedList<NavigationEntry<Header, Item>, Context>(
        {
            ...(restProps as Omit<
                VirtualizedListProps<NavigationEntry<Header, Item>, Context>,
                "items" | "isItemFocusable" | "getItemKey"
            >),
            items: flatEntries,
            isItemFocusable: wrappedIsEntryFocusable,
            getItemKey: wrappedGetEntryKey,
            mapScrollIndex,
            mapRangeIndex,
        },
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

    // Keep a ref to items so the callback always sees the latest array,
    // even when GroupedVirtuoso fires itemContent with a stale index
    // during a transition between old and new groupCounts.
    const itemsRef = useRef(items);
    itemsRef.current = items;

    const getItemComponentInternal = useCallback(
        (index: number, groupIndex: number, _item: unknown, context: VirtualizedListContext<Context>): JSX.Element => {
            const item = itemsRef.current[index];
            if (item === undefined) {
                // Race condition: virtuoso is rendering with a stale index that no longer
                // exists in the current items array. Return an empty placeholder that will
                // be replaced on the next render cycle once virtuoso reconciles.
                return <React.Fragment key={`stale-${index}`} />;
            }
            return getItemComponent(index, item, context, onFocusForItem, groupIndex);
        },
        [getItemComponent, onFocusForItem],
    );

    const getGroupHeaderComponentInternal = useCallback(
        (groupIndex: number, context: VirtualizedListContext<Context>): JSX.Element =>
            getGroupHeaderComponent(groupIndex, groups[groupIndex].header, context, onFocusForHeader),
        [getGroupHeaderComponent, onFocusForHeader, groups],
    );

    // Remove sticky headers
    const components = useMemo(
        () => ({
            TopItemList: ({ children, ...rest }: PropsWithChildren<{ style?: React.CSSProperties }>) => (
                <div {...rest} style={{ ...rest.style, position: "relative" }}>
                    {children}
                </div>
            ),
        }),
        [],
    );

    return (
        <GroupedVirtuoso
            // note that either the container of direct children must be focusable to be axe
            // compliant, so we leave tabIndex as the default so the container can be focused
            // (virtuoso wraps the children inside another couple of elements so setting it
            // on those doesn't seem to work, unfortunately)
            groupCounts={groupCounts}
            itemContent={getItemComponentInternal}
            groupContent={getGroupHeaderComponentInternal}
            {...virtuosoProps}
            components={components}
        />
    );
}

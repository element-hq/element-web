/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useCallback, useMemo } from "react";
import { Virtuoso } from "react-virtuoso";

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

const HEADER_ENTRY_PROPERTY = "header";
const HEADER_KEY_PREFIX = "header:";
const ITEM_KEY_PREFIX = "item:";

const getInternalHeaderKey = (key: string): string => `${HEADER_KEY_PREFIX}${key}`;
const getInternalItemKey = (key: string): string => `${ITEM_KEY_PREFIX}${key}`;

const isHeaderInternalKey = (key: string | undefined): boolean => key?.startsWith(HEADER_KEY_PREFIX) ?? false;
const isItemInternalKey = (key: string | undefined): boolean => key?.startsWith(ITEM_KEY_PREFIX) ?? false;

const stripInternalKeyPrefix = (key: string | undefined): string | undefined => {
    if (!key) {
        return undefined;
    }

    if (isHeaderInternalKey(key)) {
        return key.slice(HEADER_KEY_PREFIX.length);
    }

    if (isItemInternalKey(key)) {
        return key.slice(ITEM_KEY_PREFIX.length);
    }

    return key;
};

const isHeaderEntry = <Header, Item>(entry: NavigationEntry<Header, Item>): entry is { header: Header } =>
    HEADER_ENTRY_PROPERTY in entry;

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
        ...restProps
    } = props;

    // Build a flat array interleaving group headers with items.
    // Each entry is either { header } or { item }.
    const flatEntries = useMemo(
        () =>
            groups.flatMap<NavigationEntry<Header, Item>>((group) => [
                { header: group.header },
                ...group.items.map<NavigationEntry<Header, Item>>((item) => ({ item })),
            ]),
        [groups],
    );

    // Pre-compute a lookup from flat index to group index.
    // Each group contributes 1 header + N items, all mapped to the same group index.
    const flatIndexToGroupIndex = useMemo(
        () => groups.flatMap((group, groupIdx) => new Array(1 + group.items.length).fill(groupIdx)),
        [groups],
    );

    // Wrap getItemKey: dispatch to getHeaderKey or getItemKey based on entry type
    const wrappedGetEntryKey = useCallback(
        (entry: NavigationEntry<Header, Item>): string =>
            isHeaderEntry(entry)
                ? getInternalHeaderKey(getHeaderKey(entry.header))
                : getInternalItemKey(getItemKey(entry.item)),
        [getHeaderKey, getItemKey],
    );

    // Wrap isItemFocusable: headers use isGroupHeaderFocusable, items use isItemFocusable
    const wrappedIsEntryFocusable = useCallback(
        (entry: NavigationEntry<Header, Item>): boolean =>
            isHeaderEntry(entry) ? isGroupHeaderFocusable(entry.header) : isItemFocusable(entry.item),
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

    // Unified item renderer that dispatches to group header or item component
    // based on the entry type at the given flat index.
    const itemContent = useCallback(
        (
            flatIndex: number,
            entry: NavigationEntry<Header, Item>,
            context: VirtualizedListContext<Context>,
        ): JSX.Element => {
            const groupIndex = flatIndexToGroupIndex[flatIndex];
            const scopedContext: VirtualizedListContext<Context> = {
                ...context,
                tabIndexKey: isHeaderEntry(entry)
                    ? isHeaderInternalKey(context.tabIndexKey)
                        ? stripInternalKeyPrefix(context.tabIndexKey)
                        : undefined
                    : isItemInternalKey(context.tabIndexKey)
                      ? stripInternalKeyPrefix(context.tabIndexKey)
                      : undefined,
            };

            if (isHeaderEntry(entry)) {
                return getGroupHeaderComponent(groupIndex, entry.header, scopedContext, onFocusForHeader);
            }

            // Item index in the flattened (non-header) items array:
            // flatIndex minus the number of headers before it (groupIndex + 1).
            const itemIndex = flatIndex - (groupIndex + 1);
            return getItemComponent(itemIndex, entry.item, scopedContext, onFocusForItem, groupIndex);
        },
        [flatIndexToGroupIndex, getGroupHeaderComponent, getItemComponent, onFocusForItem, onFocusForHeader],
    );
    const computeItemKey = useCallback(
        (index: number, entry: NavigationEntry<Header, Item>): React.Key =>
            isHeaderEntry(entry)
                ? getInternalHeaderKey(getHeaderKey(entry.header))
                : getInternalItemKey(getItemKey(entry.item)),
        [getHeaderKey, getItemKey],
    );

    return (
        <Virtuoso
            // note that either the container of direct children must be focusable to be axe
            // compliant, so we leave tabIndex as the default so the container can be focused
            // (virtuoso wraps the children inside another couple of elements so setting it
            // on those doesn't seem to work, unfortunately)
            computeItemKey={computeItemKey}
            itemContent={itemContent}
            data={flatEntries}
            {...virtuosoProps}
        />
    );
}

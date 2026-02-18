/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useCallback, useMemo } from "react";
import { GroupedVirtuoso } from "react-virtuoso";

import { useVirtualizedList, type VirtualizedListContext, type VirtualizedListProps } from "../virtualized-list";

export interface GroupedVirtualizedListProps<Item, Context> extends Omit<VirtualizedListProps<Item, Context>, "items"> {
    groups: Item[][];

    /**
     * Function that renders the group header as a JSX element.
     * @param groupIndex - The index of the group in the list
     * @param context - The context object containing the focused key and any additional data
     * @returns JSX element representing the rendered group header
     */
    getGroupHeaderComponent: (groupIndex: number, context: VirtualizedListContext<Context>) => JSX.Element;

    /**
     * Function that renders each list item as a JSX element.
     * @param index - The index of the item in the list (relative to the entire list, not the group)
     * @param context - The context object containing the focused key and any additional data
     * @param onFocus - A callback that is required to be called when the item component receives focus
     * @returns JSX element representing the rendered item
     */
    getItemComponent: (
        index: number,
        context: VirtualizedListContext<Context>,
        onFocus: (item: Item, e: React.FocusEvent) => void,
    ) => JSX.Element;
}

/**
 * A generic grouped virtualized list component built on top of react-virtuoso.
 * Provides keyboard navigation and virtualized rendering for performance with large lists.
 *
 * @template Item - The type of data items in the list
 * @template Context - The type of additional context data passed to items
 */
export function GroupedVirtualizedList<Item, Context>(
    props: GroupedVirtualizedListProps<Item, Context>,
): React.ReactElement {
    const { getItemComponent, groups, getGroupHeaderComponent, ...restProps } = props;
    const items = useMemo(() => groups.flatMap((group) => group), [groups]);
    const groupCounts = useMemo(() => groups.map((group) => group.length), [groups]);

    const { onFocusForGetItemComponent, ...virtuosoProps } = useVirtualizedList<Item, Context>({
        items,
        ...restProps,
    });

    const getItemComponentInternal = useCallback(
        (index: number, _groupIndex: number, _item: Item, context: VirtualizedListContext<Context>): JSX.Element =>
            getItemComponent(index, context, onFocusForGetItemComponent),
        [getItemComponent, onFocusForGetItemComponent],
    );

    return (
        <GroupedVirtuoso
            // note that either the container of direct children must be focusable to be axe
            // compliant, so we leave tabIndex as the default so the container can be focused
            // (virtuoso wraps the children inside another couple of elements so setting it
            // on those doesn't seem to work, unfortunately)
            groupCounts={groupCounts}
            itemContent={getItemComponentInternal}
            groupContent={getGroupHeaderComponent}
            {...virtuosoProps}
        />
    );
}

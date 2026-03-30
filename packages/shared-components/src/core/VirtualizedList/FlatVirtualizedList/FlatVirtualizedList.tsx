/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useCallback } from "react";
import { Virtuoso } from "react-virtuoso";

import { useVirtualizedList, type VirtualizedListContext, type VirtualizedListProps } from "../virtualized-list";

export interface FlatVirtualizedListProps<Item, Context> extends VirtualizedListProps<Item, Context> {
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
        context: VirtualizedListContext<Context>,
        onFocus: (item: Item, e: React.FocusEvent) => void,
    ) => JSX.Element;
}

/**
 * A generic virtualized list component built on top of react-virtuoso.
 * Provides keyboard navigation and virtualized rendering for performance with large lists.
 *
 * @template Item - The type of data items in the list
 * @template Context - The type of additional context data passed to items
 */
export function FlatVirtualizedList<Item, Context>(props: FlatVirtualizedListProps<Item, Context>): React.ReactElement {
    const { getItemComponent, ...restProps } = props;
    const { onFocusForGetItemComponent, ref, ...virtuosoProps } = useVirtualizedList<Item, Context>(restProps);

    const getItemComponentInternal = useCallback(
        (index: number, item: Item, context: VirtualizedListContext<Context>): JSX.Element =>
            getItemComponent(index, item, context, onFocusForGetItemComponent),
        [getItemComponent, onFocusForGetItemComponent],
    );

    return (
        <Virtuoso
            // note that either the container of direct children must be focusable to be axe
            // compliant, so we leave tabIndex as the default so the container can be focused
            // (virtuoso wraps the children inside another couple of elements so setting it
            // on those doesn't seem to work, unfortunately)
            itemContent={getItemComponentInternal}
            data={props.items}
            ref={ref}
            {...virtuosoProps}
        />
    );
}

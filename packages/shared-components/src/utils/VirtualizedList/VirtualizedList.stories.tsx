/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { VirtualizedList, type IVirtualizedListProps, type VirtualizedListContext } from "./VirtualizedList";

import "./VirtualizedList.stories.css";

interface SimpleItem {
    id: string;
    label: string;
    disabled?: boolean;
}

const SimpleItemComponent = ({
    item,
    context,
    onFocus,
}: {
    item: SimpleItem;
    context: VirtualizedListContext<undefined>;
    onFocus: (item: SimpleItem, e: React.FocusEvent) => void;
}): React.JSX.Element => {
    const tabIndex = context.tabIndexKey === item.id ? 0 : -1;
    return (
        <div
            className="simple-list-item"
            tabIndex={tabIndex}
            onFocus={(e) => onFocus(item, e)}
            data-disabled={item.disabled}
        >
            {item.label}
        </div>
    );
};

const defaultItems: SimpleItem[] = Array.from({ length: 20 }, (_, i) => ({
    id: `item-${i}`,
    label: `Item ${i + 1}`,
}));

const meta = {
    title: "Utils/VirtualizedList",
    component: VirtualizedList<SimpleItem, undefined>,
    tags: ["autodocs"],
    args: {
        items: defaultItems,
        getItemComponent: (index, item, context, onFocus) => (
            <SimpleItemComponent key={item.id} item={item} context={context} onFocus={onFocus} />
        ),
        isItemFocusable: (item) => !item.disabled,
        getItemKey: (item) => item.id,
        onKeyDown: fn(),
        style: { height: "400px" },
    },
    argTypes: {
        items: {
            description: "Array of items to display in the virtualized list",
        },
        getItemComponent: {
            description: "Function that renders each list item",
        },
        isItemFocusable: {
            description: "Function to determine if an item can receive focus",
        },
        getItemKey: {
            description: "Function to get the unique key for an item",
        },
        context: {
            description: "Optional additional context data to pass to rendered items",
        },
        onKeyDown: {
            description: "Callback for keyboard events not handled by List",
        },
    },
} satisfies Meta<IVirtualizedListProps<SimpleItem, undefined>>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default List with basic items
 */
export const Default: Story = {};

/**
 * List with a large number of items to demonstrate virtualization
 */
export const LargeList: Story = {
    args: {
        items: Array.from({ length: 1000 }, (_, i) => ({
            id: `item-${i}`,
            label: `Item ${i + 1}`,
        })),
        style: { height: "600px" },
    },
};

/**
 * List with some disabled items that cannot be focused
 */
export const WithDisabledItems: Story = {
    args: {
        items: Array.from({ length: 20 }, (_, i) => ({
            id: `item-${i}`,
            label: `Item ${i + 1}`,
            disabled: i % 3 === 0,
        })),
        style: { height: "400px" },
    },
};

/**
 * List with custom styling
 */
export const CustomStyling: Story = {
    args: {
        items: Array.from({ length: 50 }, (_, i) => ({
            id: `item-${i}`,
            label: `Custom styled item ${i + 1}`,
        })),
        className: "custom-list",
        style: { height: "400px" },
    },
};

/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { VirtualizedList, type IVirtualizedListProps, type VirtualizedListContext } from "./VirtualizedList";

interface SimpleItem {
    id: string;
    label: string;
}

const items: SimpleItem[] = Array.from({ length: 50 }, (_, i) => ({
    id: `item-${i}`,
    label: `Item ${i + 1}`,
}));

const meta = {
    title: "Utils/VirtualizedList",
    component: VirtualizedList<SimpleItem, undefined>,
    args: {
        items,
        getItemComponent: (
            _index: number,
            item: SimpleItem,
            context: VirtualizedListContext<undefined>,
            onFocus: (item: SimpleItem, e: React.FocusEvent) => void,
        ) => (
            <div
                key={item.id}
                style={{ padding: "12px 16px", borderBottom: "1px solid #e0e0e0" }}
                tabIndex={context.tabIndexKey === item.id ? 0 : -1}
                onFocus={(e) => onFocus(item, e)}
            >
                {item.label}
            </div>
        ),
        isItemFocusable: () => true,
        getItemKey: (item) => item.id,
        style: { height: "400px" },
    },
} satisfies Meta<IVirtualizedListProps<SimpleItem, undefined>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

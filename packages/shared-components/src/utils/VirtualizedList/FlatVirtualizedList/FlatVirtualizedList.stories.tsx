/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { FlatVirtualizedList, type FlatVirtualizedListProps } from "./FlatVirtualizedList";
import { type VirtualizedListContext } from "../virtualized-list";
import { items, SimpleItemComponent } from "../story-mock";
import { getContainerAccessibleProps, getItemAccessibleProps } from "../accessbility";

const meta = {
    title: "Utils/VirtualizedList/FlatVirtualizedList",
    component: FlatVirtualizedList<SimpleItemComponent, undefined>,
    args: {
        items,
        "getItemComponent": (
            index: number,
            item: SimpleItemComponent,
            context: VirtualizedListContext<undefined>,
            onFocus: (item: SimpleItemComponent, e: React.FocusEvent) => void,
        ) => (
            <SimpleItemComponent
                key={item.id}
                item={item}
                context={context}
                onFocus={onFocus}
                {...getItemAccessibleProps("listbox", index, items.length)}
            />
        ),
        "isItemFocusable": () => true,
        "getItemKey": (item) => item.id,
        "style": { height: "400px" },
        "aria-label": "Flat virtualized list",
        ...getContainerAccessibleProps("listbox"),
    },
} satisfies Meta<FlatVirtualizedListProps<SimpleItemComponent, undefined>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Meta, type StoryObj } from "@storybook/react-vite";
import React from "react";

import { GroupedVirtualizedList, type GroupedVirtualizedListProps } from "./GroupedVirtualizedList";
import { type VirtualizedListContext } from "../virtualized-list";
import { GroupHeaderComponent, groups, SimpleItemComponent, type SimpleGroupHeader } from "../story-mock";
import { getContainerAccessibleProps, getGroupHeaderAccessibleProps, getItemAccessibleProps } from "../accessbility";

// Calculate total rows for ARIA props (group headers + items)
const totalRows = groups.reduce((total, group) => total + 1 + group.items.length, 0);

const meta = {
    title: "Utils/VirtualizedList/GroupedVirtualizedList",
    component: GroupedVirtualizedList<SimpleGroupHeader, SimpleItemComponent, undefined>,
    args: {
        groups,
        "getItemComponent": (
            _index: number,
            item: SimpleItemComponent,
            context: VirtualizedListContext<undefined>,
            onFocus: (item: SimpleItemComponent, e: React.FocusEvent) => void,
            groupIndex: number,
        ) => {
            const group = groups[groupIndex];
            const indexInGroup = group.items.findIndex((i) => i.id === item.id);
            const index = groups.slice(0, groupIndex).reduce((sum, g) => sum + 1 + g.items.length, indexInGroup + 1);

            return (
                <SimpleItemComponent
                    key={item.id}
                    item={item}
                    context={context}
                    onFocus={onFocus}
                    {...getItemAccessibleProps("treegrid", index, indexInGroup)}
                />
            );
        },
        "getGroupHeaderComponent": (
            groupIndex: number,
            header: SimpleGroupHeader,
            context: VirtualizedListContext<undefined>,
            onFocus: (header: SimpleGroupHeader, e: React.FocusEvent) => void,
        ) => {
            const index = groups.slice(0, groupIndex).reduce((sum, g) => sum + 1 + g.items.length, 0);
            const groupSize = groups[groupIndex].items.length;

            return (
                <GroupHeaderComponent
                    key={header.id}
                    header={header}
                    context={context}
                    onFocus={onFocus}
                    {...getGroupHeaderAccessibleProps(index, groupIndex, groupSize)}
                />
            );
        },
        "isItemFocusable": () => true,
        "isGroupHeaderFocusable": () => true,
        "getItemKey": (item) => item.id,
        "getHeaderKey": (header) => header.id,
        "style": { height: "400px" },
        "aria-label": "Grouped virtualized list",
        ...getContainerAccessibleProps("treegrid", totalRows),
    },
} satisfies Meta<GroupedVirtualizedListProps<SimpleGroupHeader, SimpleItemComponent, undefined>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

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
import { GroupHeaderComponent, groups, items, SimpleItemComponent } from "../story-mock";

const meta = {
    title: "Utils/VirtualizedList/GroupedVirtualizedList",
    component: GroupedVirtualizedList<SimpleItemComponent, undefined>,
    args: {
        groups,
        getItemComponent: (
            index: number,
            context: VirtualizedListContext<undefined>,
            onFocus: (item: SimpleItemComponent, e: React.FocusEvent) => void,
        ) => {
            const item = items[index];
            return <SimpleItemComponent key={item.id} item={item} context={context} onFocus={onFocus} />;
        },
        getGroupHeaderComponent: (groupIndex: number) => (
            <GroupHeaderComponent key={`group-${groupIndex}`} groupIndex={groupIndex} />
        ),
        isItemFocusable: () => true,
        getItemKey: (item) => item.id,
        style: { height: "400px" },
    },
} satisfies Meta<GroupedVirtualizedListProps<SimpleItemComponent, undefined>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

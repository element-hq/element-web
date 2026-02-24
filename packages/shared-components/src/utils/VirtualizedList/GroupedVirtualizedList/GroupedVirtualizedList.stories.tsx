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

const meta = {
    title: "Utils/VirtualizedList/GroupedVirtualizedList",
    component: GroupedVirtualizedList<SimpleGroupHeader, SimpleItemComponent, undefined>,
    args: {
        groups,
        getItemComponent: (
            index: number,
            item: SimpleItemComponent,
            context: VirtualizedListContext<undefined>,
            onFocus: (item: SimpleItemComponent, e: React.FocusEvent) => void,
        ) => <SimpleItemComponent key={item.id} item={item} context={context} onFocus={onFocus} />,
        "getGroupHeaderComponent": (
            _groupIndex: number,
            header: SimpleGroupHeader,
            context: VirtualizedListContext<undefined>,
            onFocus: (header: SimpleGroupHeader, e: React.FocusEvent) => void,
        ) => <GroupHeaderComponent key={header.id} header={header} context={context} onFocus={onFocus} />,
        "isItemFocusable": () => true,
        "isGroupHeaderFocusable": () => true,
        "getItemKey": (item) => item.id,
        "getHeaderKey": (header) => header.id,
        "style": { height: "400px" },
        "role": "listbox",
        "aria-label": "Grouped virtualized list",
    },
} satisfies Meta<GroupedVirtualizedListProps<SimpleGroupHeader, SimpleItemComponent, undefined>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

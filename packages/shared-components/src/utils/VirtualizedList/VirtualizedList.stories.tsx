/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { useDraggable, useDragOperation, useDroppable } from "@dnd-kit/react";

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

function ItemComponent({
    item,
    context,
    onFocus,
}: {
    item: SimpleItem;
    context: VirtualizedListContext<undefined>;
    onFocus: (item: SimpleItem, e: React.FocusEvent) => void;
}): JSX.Element {
    const { ref } = useDraggable({
        id: item.id,
        feedback: "clone",
    });

    return (
        <div
            ref={ref}
            key={item.id}
            style={{ padding: "12px 16px", borderBottom: "1px solid #e0e0e0" }}
            tabIndex={context.tabIndexKey === item.id ? 0 : -1}
            onFocus={(e) => onFocus(item, e)}
        >
            {item.label}
        </div>
    );
}

function DragOverlayContent(): JSX.Element | null {
    const { source } = useDragOperation();
    if (!source) return null;

    const item = items.find((i) => i.id === source.id);
    if (!item) return null;

    return (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #e0e0e0", width: "100%", background: "white" }}>
            {item.label}
        </div>
    );
}

const groups = [
    {
        group: "Group 1",
        items: items.slice(0, 25),
    },
    {
        group: "Group 2",
        items: items.slice(25, items.length),
    },
];

function GroupComponent({ index }: { index: number }): JSX.Element {
    const { ref, isDropTarget } = useDroppable({ id: `group-${index}` });

    return (
        <div
            ref={ref}
            style={{
                backgroundColor: isDropTarget ? "lightgreen" : "teal",
                height: 40,
                display: "flex",
                alignContent: "center",
            }}
        >
            Group {index}
        </div>
    );
}

const meta = {
    title: "Utils/VirtualizedList",
    component: VirtualizedList<SimpleItem, undefined>,
    args: {
        groups,
        getItemComponent: (
            index: number,
            groupIndex: number,
            _item: SimpleItem,
            context: VirtualizedListContext<undefined>,
            onFocus: (item: SimpleItem, e: React.FocusEvent) => void,
        ) => {
            const item = items[index];
            if (!item) return <div>Item not found</div>;
            return <ItemComponent key={item.id} item={item} context={context} onFocus={onFocus} />;
        },
        getGroupComponent: (index) => <GroupComponent key={index} index={index} />,
        isItemFocusable: () => true,
        getItemKey: (item) => item.id,
        style: { height: "400px" },
        dragOverlay: <DragOverlayContent />,
    },
} satisfies Meta<IVirtualizedListProps<SimpleItem, undefined>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

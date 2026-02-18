/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { memo } from "react";
import { type JSX } from "react";

import { type VirtualizedListContext } from "./virtualized-list";

export interface SimpleItemComponent {
    id: string;
    label: string;
}

export const items: SimpleItemComponent[] = Array.from({ length: 50 }, (_, i) => ({
    id: `item-${i}`,
    label: `Item ${i + 1}`,
}));

export const groups: SimpleItemComponent[][] = [items.slice(0, 10), items.slice(10, 30), items.slice(30, 50)];

interface SimpleItemComponentProps<Context> {
    item: SimpleItemComponent;
    context: Context;
    onFocus: (item: SimpleItemComponent, e: React.FocusEvent) => void;
}

export const SimpleItemComponent = memo(function SimpleItemComponent({
    item,
    context,
    onFocus,
}: SimpleItemComponentProps<VirtualizedListContext<undefined>>): JSX.Element {
    return (
        <div
            key={item.id}
            style={{ padding: "12px 16px", borderBottom: "1px solid #e0e0e0" }}
            tabIndex={context.tabIndexKey === item.id ? 0 : -1}
            onFocus={(e) => onFocus(item, e)}
        >
            {item.label}
        </div>
    );
});


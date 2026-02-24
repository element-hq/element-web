/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { memo } from "react";
import { type JSX } from "react";
import classNames from "classnames";

import { type VirtualizedListContext } from "./virtualized-list";
import type { Group } from "./GroupedVirtualizedList";
import styles from "./story-mock.module.css";

export interface SimpleItemComponent {
    id: string;
    label: string;
}

export interface SimpleGroupHeader {
    id: string;
    label: string;
}

export const items: SimpleItemComponent[] = Array.from({ length: 50 }, (_, i) => ({
    id: `item-${i}`,
    label: `Item ${i + 1}`,
}));

export const groups: Group<SimpleGroupHeader, SimpleItemComponent>[] = [
    { header: { id: "group-1", label: "Group 1" }, items: items.slice(0, 10) },
    { header: { id: "group-2", label: "Group 2" }, items: items.slice(10, 30) },
    { header: { id: "group-3", label: "Group 3" }, items: items.slice(30, 50) },
];

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
    const selected = context.tabIndexKey === item.id;

    return (
        <button
            type="button"
            key={item.id}
            className={classNames(styles.item, { [styles.itemSelected]: selected })}
            tabIndex={selected ? 0 : -1}
            onFocus={(e) => onFocus(item, e)}
        >
            {item.label}
        </button>
    );
});

interface GroupHeaderComponentProps {
    header: SimpleGroupHeader;
    context: VirtualizedListContext<undefined>;
    onFocus: (header: SimpleGroupHeader, e: React.FocusEvent) => void;
}

export const GroupHeaderComponent = memo(function GroupHeaderComponent({
    header,
    context,
    onFocus,
}: GroupHeaderComponentProps): JSX.Element {
    const selected = context.tabIndexKey === header.id;

    return (
        <button
            type="button"
            id={header.id}
            key={header.id}
            className={classNames(styles.group, { [styles.groupSelected]: selected })}
            tabIndex={selected ? 0 : -1}
            onFocus={(e) => onFocus(header, e)}
        >
            {header.label}
        </button>
    );
});

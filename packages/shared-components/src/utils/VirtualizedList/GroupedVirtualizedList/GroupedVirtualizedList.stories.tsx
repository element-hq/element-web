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
    parameters: {
        docs: {
            description: {
                component: `
A grouped virtualized list that renders large datasets organised into labelled sections
efficiently using [react-virtuoso](https://virtuoso.dev/), while exposing full keyboard
navigation and ARIA accessibility support for both group headers and child items.

## Accessibility with **\`treegrid\`** ARIA pattern

This example uses the **\`treegrid\`** ARIA pattern. A treegrid models a
two-level hierarchy: group headers sit at **level 1** and their child items sit at
**level 2**. This lets assistive technologies announce both the group structure and the
position of each item within its group.

### Container props — \`getContainerAccessibleProps("treegrid", totalRows)\`

Spread the result of \`getContainerAccessibleProps("treegrid", totalRows)\` directly onto the
\`GroupedVirtualizedList\` component to mark the scrollable container as a \`treegrid\`:

| Prop | Value | Purpose |
|------|-------|---------|
| \`role\` | \`"treegrid"\` | Identifies the container as a treegrid widget to assistive technologies. |
| \`aria-rowcount\` | \`totalRows\` | Total number of rows in the treegrid (group headers + items). Because virtualization only mounts a subset of rows, browsers cannot count them from the DOM — this attribute supplies the true count so screen readers can announce e.g. *"row 12 of 53"*. |

\`totalRows\` must include **every** row that will ever appear: one per group header plus one
per item across all groups.

\`\`\`tsx
const totalRows = groups.reduce((total, group) => total + 1 + group.items.length, 0);

<GroupedVirtualizedList
  {...getContainerAccessibleProps("treegrid", totalRows)}
  aria-label="My grouped list"
  {/* other props */}
/>
\`\`\`

---

### Group header props — \`getGroupHeaderAccessibleProps(index, groupIndex, groupSize)\`

Spread the result of \`getGroupHeaderAccessibleProps\` onto each rendered group header element
to place it at level 1 in the tree hierarchy:

| Prop | Value | Purpose |
|------|-------|---------|
| \`role\` | \`"row"\` | Identifies the element as a row within the treegrid. |
| \`aria-level\` | \`1\` | Places the header at the root level of the tree hierarchy. |
| \`aria-posinset\` | \`groupIndex + 1\` | 1-based position of this group among all groups. |
| \`aria-rowindex\` | \`index + 1\` | 1-based position of this row in the full flat row sequence (headers + items). |
| \`aria-setsize\` | \`groupSize\` | Total number of items inside this group. |

The list also uses a [roving tabindex](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_roving_tabindex)
pattern: \`context.tabIndexKey\` holds the key of the element that currently owns focus. Set
\`tabIndex={0}\` on the matching gridcell and \`tabIndex={-1}\` on every other to keep the
list to a single tab stop while arrow-key navigation moves focus between rows.

\`\`\`tsx
getGroupHeaderComponent={(groupIndex, header, context, onFocus) => {
  // Flat row index: sum of (1 header + N items) for every preceding group
  const index = groups
    .slice(0, groupIndex)
    .reduce((sum, g) => sum + 1 + g.items.length, 0);

  const groupSize = groups[groupIndex].items.length;
  const selected = context.tabIndexKey === header.id;

  return (
    <div
      {...getGroupHeaderAccessibleProps(index, groupIndex, groupSize)}
    >
      {/* Direct child must be a gridcell */}
      <button
        role="gridcell"
        type="button"
        tabIndex={selected ? 0 : -1}
        onFocus={(e) => onFocus(header, e)}
        onClick={() => console.log("Clicked group header")}}
      >
        {header.label}
      </button>
    </div>
  );
}}
\`\`\`

---

### Item props — \`getItemAccessibleProps("treegrid", index, indexInGroup)\`

Spread the result of \`getItemAccessibleProps("treegrid", index, indexInGroup)\` onto each
rendered item element to place it at level 2 in the tree hierarchy:

| Prop | Value | Purpose |
|------|-------|---------|
| \`role\` | \`"row"\` | Identifies the element as a row within the treegrid. |
| \`aria-level\` | \`2\` | Places the item as a child of its group header at level 1. |
| \`aria-rowindex\` | \`index + 1\` | 1-based position of this row in the full flat row sequence (headers + items). |
| \`aria-posinset\` | \`indexInGroup + 1\` | 1-based position of this item within its own group. |

Both \`index\` (flat row index across the whole treegrid) and \`indexInGroup\` (position
within the item's group) must be computed before passing to the function.
As with group headers, apply the [roving tabindex](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_roving_tabindex)
pattern using \`context.tabIndexKey\` to keep the list to a single tab stop.

\`\`\`tsx
getItemComponent={(_, item, context, onFocus, groupIndex) => {
  const group = groups[groupIndex];
  const indexInGroup = group.items.findIndex((i) => i.id === item.id);

  // Flat row index: skip (1 header + N items) per preceding group, then add
  // 1 for the current group's header, then the item's position within the group.
  const index = groups
    .slice(0, groupIndex)
    .reduce((sum, g) => sum + 1 + g.items.length, indexInGroup + 1);

  const selected = context.tabIndexKey === item.id;

  return (
    <div
      {...getItemAccessibleProps("treegrid", index, indexInGroup)}
    >
      {/* Direct child must be a gridcell */}
      <button
        role="gridcell"
        type="button"
        tabIndex={selected ? 0 : -1}
        onFocus={(e) => onFocus(item, e)}
        onClick={() => console.log("Clicked item")}}
      >
        {item.label}
      </button>
    </div>
  );
}}
\`\`\`
                `,
            },
        },
    },
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

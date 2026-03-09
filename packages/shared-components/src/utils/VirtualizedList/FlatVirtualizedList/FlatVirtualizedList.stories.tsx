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
    parameters: {
        docs: {
            description: {
                component: `
A flat virtualized list that renders large datasets efficiently using
[react-virtuoso](https://virtuoso.dev/), while exposing full keyboard navigation.

## Accessibility with **\`listbox\`** ARIA pattern

This example uses the **\`listbox\`** ARIA pattern, which maps naturally to a
flat list of selectable options.

### Container props — \`getContainerAccessibleProps("listbox")\`

Spread the result of \`getContainerAccessibleProps("listbox")\` directly onto the
\`FlatVirtualizedList\` component to mark the scrollable container as a \`listbox\`:

| Prop | Value | Purpose |
|------|-------|---------|
| \`role\` | \`"listbox"\` | Identifies the container as a listbox widget to assistive technologies. |

\`\`\`tsx
<FlatVirtualizedList
  {...getContainerAccessibleProps("listbox")}
  aria-label="My list"
  {/* other props */}
/>
\`\`\`

### Item props — \`getItemAccessibleProps("listbox", index, listSize)\`

Spread the result of \`getItemAccessibleProps("listbox", index, listSize)\` onto each rendered
item element so that screen readers can announce position and total count even when most DOM
nodes are not mounted (virtualized):

| Prop | Value | Purpose |
|------|-------|---------|
| \`role\` | \`"option"\` | Identifies the element as a selectable option within the listbox. |
| \`aria-posinset\` | \`index + 1\` | 1-based position of this option within the full set. |
| \`aria-setsize\` | \`listSize\` | Total number of options in the list. |

The list uses a [roving tabindex](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_roving_tabindex)
pattern: \`context.tabIndexKey\` holds the key of the item that currently owns focus. Set
\`tabIndex={0}\` on the matching item and \`tabIndex={-1}\` on every other to keep the list
to a single tab stop while arrow-key navigation moves focus between items.

\`\`\`tsx
getItemComponent={(index, item, context, onFocus) => {
  const selected = context.tabIndexKey === item.id;

  return (
    <button
      type="button"
      tabIndex={selected ? 0 : -1}
      {...getItemAccessibleProps("listbox", index, items.length)}
      onFocus={(e) => onFocus(item, e)}
      onClick={() => console.log("Clicked item")}}
    >
      {item.label}
    </button>
  );
}}
\`\`\`
                `,
            },
        },
    },
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

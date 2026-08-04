/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";

import {
    eventTileStoryDefaults,
    EventTileViewStory,
} from "./EventTileView.story-fixtures";

const meta = {
    title: "Timeline/EventTileView/States",
    component: EventTileViewStory,
    tags: ["autodocs"],
    render: (args) => <EventTileViewStory {...args} />,
    argTypes: {
        shape: {
            control: "select",
            options: ["Room", "Thread", "ThreadsList", "File", "Notification", "Search", "Pinned"],
        },
        classNames: { table: { disable: true } },
        state: {
            control: "object",
        },
        onMouseEnter: { table: { disable: true } },
        onMouseLeave: { table: { disable: true } },
        onFocus: { table: { disable: true } },
        onBlur: { table: { disable: true } },
        onClick: { table: { disable: true } },
        onContextMenu: { table: { disable: true } },
        onPermalinkClick: { table: { disable: true } },
        onPermalinkContextMenu: { table: { disable: true } },
        refs: { table: { disable: true } },
        slots: { table: { category: "Slots" } },
    },
    args: {
        ...eventTileStoryDefaults,
        shape: "Room",
        state: {},
        roomMessages: "alice",
    },
} satisfies Meta<typeof EventTileViewStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Highlighted: Story = {
    args: {
        state: { highlighted: true },
    },
};

export const Selected: Story = {
    args: {
        state: { selected: true },
    },
};

export const Editing: Story = {
    args: {
        state: { editing: true },
    },
};

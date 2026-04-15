/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoomListItemAccessibilityWrapper } from "./RoomListItemAccessibilityWrapper";
import { createMockRoomItemViewModel, renderAvatar } from "../../story-mocks";

const meta = {
    title: "RoomList/VirtualizedRoomListView/RoomListItemAccessibilityWrapper",
    component: RoomListItemAccessibilityWrapper,
    tags: ["autodocs"],
    args: {
        roomIndex: 0,
        roomIndexInSection: 0,
        roomCount: 10,
        onFocus: fn(),
        isFirstItem: false,
        isLastItem: false,
        renderAvatar,
        isSelected: false,
        isFocused: false,
        vm: createMockRoomItemViewModel("!room:server", "Room name", 0),
    },
    decorators: [
        (Story) => (
            <div style={{ width: "320px", padding: "8px" }}>
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof RoomListItemAccessibilityWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FlatList: Story = {
    args: {
        isInFlatList: true,
    },
    decorators: [
        (Story) => (
            <div role="listbox" aria-label="Room list">
                <Story />
            </div>
        ),
    ],
};

export const Sections: Story = {
    args: {
        isInFlatList: false,
    },
    decorators: [
        (Story) => (
            <div role="treegrid" aria-label="Room list" aria-rowcount={10}>
                <Story />
            </div>
        ),
    ],
};

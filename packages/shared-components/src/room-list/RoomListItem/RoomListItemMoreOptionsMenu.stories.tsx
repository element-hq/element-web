/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";
import { userEvent, within } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoomListItemMoreOptionsMenu } from "./RoomListItemMoreOptionsMenu";
import { type RoomListItemSnapshot, type RoomListItemActions } from "./RoomListItem";
import { useMockedViewModel } from "../../viewmodel";
import { defaultSnapshot } from "./default-snapshot";

type MoreOptionsMenuProps = RoomListItemSnapshot & RoomListItemActions;

// Wrapper component that creates a mocked ViewModel
const MoreOptionsMenuWrapper = ({
    onOpenRoom,
    onMarkAsRead,
    onMarkAsUnread,
    onToggleFavorite,
    onToggleLowPriority,
    onInvite,
    onCopyRoomLink,
    onLeaveRoom,
    onSetRoomNotifState,
    ...rest
}: MoreOptionsMenuProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        onOpenRoom,
        onMarkAsRead,
        onMarkAsUnread,
        onToggleFavorite,
        onToggleLowPriority,
        onInvite,
        onCopyRoomLink,
        onLeaveRoom,
        onSetRoomNotifState,
    });
    return <RoomListItemMoreOptionsMenu vm={vm} />;
};

const meta = {
    title: "Room List/RoomListItem/MoreOptionsMenu",
    component: MoreOptionsMenuWrapper,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <div style={{ padding: "16px" }}>
                <Story />
            </div>
        ),
    ],
    args: {
        ...defaultSnapshot,
        showMoreOptionsMenu: true,
        onOpenRoom: fn(),
        onMarkAsRead: fn(),
        onMarkAsUnread: fn(),
        onToggleFavorite: fn(),
        onToggleLowPriority: fn(),
        onInvite: fn(),
        onCopyRoomLink: fn(),
        onLeaveRoom: fn(),
        onSetRoomNotifState: fn(),
    },
} satisfies Meta<typeof MoreOptionsMenuWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

// Reusable play function to open the menu
const openMenu: Story["play"] = async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "More Options" });
    await userEvent.click(trigger);
};

// Closed state
export const Default: Story = {};

// Open state - default (can mark as unread, favourite off, low priority off)
export const Open: Story = {
    play: openMenu,
};

// Open state - can mark as read (has unread messages)
export const OpenCanMarkAsRead: Story = {
    args: {
        canMarkAsRead: true,
        canMarkAsUnread: false,
    },
    play: openMenu,
};

// Open state - favourite enabled
export const OpenFavouriteOn: Story = {
    args: {
        isFavourite: true,
    },
    play: openMenu,
};

// Open state - low priority enabled
export const OpenLowPriorityOn: Story = {
    args: {
        isLowPriority: true,
    },
    play: openMenu,
};

// Open state - without invite option (DM or no permission)
export const OpenWithoutInvite: Story = {
    args: {
        canInvite: false,
    },
    play: openMenu,
};

// Open state - without copy room link (DM room)
export const OpenWithoutCopyLink: Story = {
    args: {
        canCopyRoomLink: false,
    },
    play: openMenu,
};

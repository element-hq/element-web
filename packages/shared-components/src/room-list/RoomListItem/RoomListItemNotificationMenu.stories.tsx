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
import { RoomListItemNotificationMenu } from "./RoomListItemNotificationMenu";
import { type RoomListItemSnapshot, type RoomListItemActions } from "./RoomListItem";
import { useMockedViewModel } from "../../viewmodel";
import { defaultSnapshot } from "./default-snapshot";
import { RoomNotifState } from "./RoomNotifs";

type NotificationMenuProps = RoomListItemSnapshot & RoomListItemActions;

// Wrapper component that creates a mocked ViewModel
const NotificationMenuWrapper = ({
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
}: NotificationMenuProps): JSX.Element => {
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
    return <RoomListItemNotificationMenu vm={vm} />;
};

const meta = {
    title: "Room List/RoomListItem/NotificationMenu",
    component: NotificationMenuWrapper,
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
} satisfies Meta<typeof NotificationMenuWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        roomNotifState: RoomNotifState.AllMessages,
    },
};

export const Muted: Story = {
    args: {
        roomNotifState: RoomNotifState.Mute,
    },
};

export const Open: Story = {
    args: {
        roomNotifState: RoomNotifState.AllMessages,
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const trigger = canvas.getByRole("button", { name: "Notification options" });
        await userEvent.click(trigger);
    },
};

export const OpenMuted: Story = {
    args: {
        roomNotifState: RoomNotifState.Mute,
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const trigger = canvas.getByRole("button", { name: "Notification options" });
        await userEvent.click(trigger);
    },
};

export const AllMessagesLoud: Story = {
    args: {
        roomNotifState: RoomNotifState.AllMessagesLoud,
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const trigger = canvas.getByRole("button", { name: "Notification options" });
        await userEvent.click(trigger);
    },
};

export const MentionsOnly: Story = {
    args: {
        roomNotifState: RoomNotifState.MentionsOnly,
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const trigger = canvas.getByRole("button", { name: "Notification options" });
        await userEvent.click(trigger);
    },
};

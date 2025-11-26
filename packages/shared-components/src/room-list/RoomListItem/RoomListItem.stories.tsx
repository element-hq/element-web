/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import { RoomListItem, type RoomListItemViewModel } from "./RoomListItem";
import type { NotificationDecorationViewModel } from "../../notifications/NotificationDecoration";
import type { RoomListItemMenuViewModel } from "./RoomListItemMenuViewModel";
import type { RoomNotifState } from "../../notifications/RoomNotifs";
import type { Meta, StoryObj } from "@storybook/react-vite";

// Mock avatar component
const mockAvatar = (
    <div
        style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            backgroundColor: "#0dbd8b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: "bold",
        }}
    >
        TR
    </div>
);

// Mock notification view model with notifications
const mockNotificationViewModel: NotificationDecorationViewModel = {
    hasAnyNotificationOrActivity: true,
    isUnsentMessage: false,
    invited: false,
    isMention: false,
    isActivityNotification: false,
    isNotification: true,
    count: 3,
    muted: false,
};

// Mock notification view model without notifications
const mockEmptyNotificationViewModel: NotificationDecorationViewModel = {
    hasAnyNotificationOrActivity: false,
    isUnsentMessage: false,
    invited: false,
    isMention: false,
    isActivityNotification: false,
    isNotification: false,
    count: 0,
    muted: false,
};

// Mock menu view model
const mockMenuViewModel: RoomListItemMenuViewModel = {
    showMoreOptionsMenu: true,
    showNotificationMenu: true,
    isFavourite: false,
    isLowPriority: false,
    canInvite: true,
    canCopyRoomLink: true,
    canMarkAsRead: true,
    canMarkAsUnread: true,
    isNotificationAllMessage: true,
    isNotificationAllMessageLoud: false,
    isNotificationMentionOnly: false,
    isNotificationMute: false,
    markAsRead: () => console.log("Mark as read"),
    markAsUnread: () => console.log("Mark as unread"),
    toggleFavorite: () => console.log("Toggle favorite"),
    toggleLowPriority: () => console.log("Toggle low priority"),
    invite: () => console.log("Invite"),
    copyRoomLink: () => console.log("Copy room link"),
    leaveRoom: () => console.log("Leave room"),
    setRoomNotifState: (state: RoomNotifState) => console.log("Set notification state:", state),
};

const baseViewModel: RoomListItemViewModel = {
    id: "!test:example.org",
    name: "Test Room",
    openRoom: () => console.log("Opening room"),
    a11yLabel: "Test Room, no unread messages",
    isBold: false,
    messagePreview: undefined,
    notificationViewModel: mockEmptyNotificationViewModel,
    menuViewModel: mockMenuViewModel,
};

const meta = {
    title: "Room List/RoomListItem",
    component: RoomListItem,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <div style={{ width: "320px", border: "1px solid #ccc" }}>
                <Story />
            </div>
        ),
    ],
    args: {
        viewModel: baseViewModel,
        isSelected: false,
        isFocused: false,
        onFocus: () => {},
        roomIndex: 0,
        roomCount: 10,
        avatar: mockAvatar,
    },
} satisfies Meta<typeof RoomListItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithMessagePreview: Story = {
    args: {
        viewModel: {
            ...baseViewModel,
            messagePreview: "Alice: Hey, are you coming to the meeting?",
        },
    },
};

export const WithUnread: Story = {
    args: {
        viewModel: {
            ...baseViewModel,
            name: "Team Chat",
            isBold: true,
            a11yLabel: "Team Chat, 3 unread messages",
            notificationViewModel: mockNotificationViewModel,
        },
    },
};

export const Selected: Story = {
    args: {
        isSelected: true,
    },
};

export const Focused: Story = {
    args: {
        isFocused: true,
    },
};

export const LongRoomName: Story = {
    args: {
        viewModel: {
            ...baseViewModel,
            name: "This is a very long room name that should be truncated with ellipsis when it exceeds the available width",
            messagePreview: "And this is also a very long message preview that should also be truncated",
        },
    },
};

export const BoldWithPreview: Story = {
    args: {
        viewModel: {
            ...baseViewModel,
            name: "Design Team",
            isBold: true,
            messagePreview: "Bob shared a new design file",
            notificationViewModel: mockNotificationViewModel,
        },
    },
};

export const AllStates: Story = {
    render: (): React.ReactElement => (
        <div style={{ width: "320px" }}>
            <RoomListItem
                viewModel={baseViewModel}
                isSelected={false}
                isFocused={false}
                onFocus={() => {}}
                roomIndex={0}
                roomCount={5}
                avatar={mockAvatar}
            />
            <RoomListItem
                viewModel={{ ...baseViewModel, isBold: true, notificationViewModel: mockNotificationViewModel }}
                isSelected={false}
                isFocused={false}
                onFocus={() => {}}
                roomIndex={1}
                roomCount={5}
                avatar={mockAvatar}
            />
            <RoomListItem
                viewModel={baseViewModel}
                isSelected={true}
                isFocused={false}
                onFocus={() => {}}
                roomIndex={2}
                roomCount={5}
                avatar={mockAvatar}
            />
            <RoomListItem
                viewModel={{ ...baseViewModel, messagePreview: "Latest message" }}
                isSelected={false}
                isFocused={false}
                onFocus={() => {}}
                roomIndex={3}
                roomCount={5}
                avatar={mockAvatar}
            />
            <RoomListItem
                viewModel={baseViewModel}
                isSelected={false}
                isFocused={true}
                onFocus={() => {}}
                roomIndex={4}
                roomCount={5}
                avatar={mockAvatar}
            />
        </div>
    ),
};

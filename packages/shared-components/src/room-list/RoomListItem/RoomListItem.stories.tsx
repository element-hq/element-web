/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import { RoomListItemView, type RoomListItem, type RoomListItemCallbacks } from "./RoomListItem";
import type { NotificationDecorationData } from "../../notifications/NotificationDecoration";
import type { MoreOptionsMenuState, MoreOptionsMenuCallbacks } from "./RoomListItemMoreOptionsMenu";
import type { NotificationMenuState } from "./RoomListItemNotificationMenu";
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

// Mock notification data with notifications
const mockNotificationData: NotificationDecorationData = {
    hasAnyNotificationOrActivity: true,
    isUnsentMessage: false,
    invited: false,
    isMention: false,
    isActivityNotification: false,
    isNotification: true,
    count: 3,
    muted: false,
};

// Mock notification data without notifications
const mockEmptyNotificationData: NotificationDecorationData = {
    hasAnyNotificationOrActivity: false,
    isUnsentMessage: false,
    invited: false,
    isMention: false,
    isActivityNotification: false,
    isNotification: false,
    muted: false,
};

// Mock more options menu state
const mockMoreOptionsState: MoreOptionsMenuState = {
    isFavourite: false,
    isLowPriority: false,
    canInvite: true,
    canCopyRoomLink: true,
    canMarkAsRead: true,
    canMarkAsUnread: true,
};

// Mock notification menu state
const mockNotificationState: NotificationMenuState = {
    isNotificationAllMessage: true,
    isNotificationAllMessageLoud: false,
    isNotificationMentionOnly: false,
    isNotificationMute: false,
};

// Mock callbacks
const mockMoreOptionsCallbacks: MoreOptionsMenuCallbacks = {
    onMarkAsRead: () => console.log("Mark as read"),
    onMarkAsUnread: () => console.log("Mark as unread"),
    onToggleFavorite: () => console.log("Toggle favorite"),
    onToggleLowPriority: () => console.log("Toggle low priority"),
    onInvite: () => console.log("Invite"),
    onCopyRoomLink: () => console.log("Copy room link"),
    onLeaveRoom: () => console.log("Leave room"),
};

const baseItem: RoomListItem = {
    id: "!test:example.org",
    name: "Test Room",
    a11yLabel: "Test Room, no unread messages",
    isBold: false,
    messagePreview: undefined,
    notification: mockEmptyNotificationData,
    showMoreOptionsMenu: true,
    showNotificationMenu: true,
    moreOptionsState: mockMoreOptionsState,
    notificationState: mockNotificationState,
};

const baseCallbacks: RoomListItemCallbacks = {
    onOpenRoom: () => console.log("Opening room"),
    moreOptionsCallbacks: mockMoreOptionsCallbacks,
    onSetRoomNotifState: (state: RoomNotifState) => console.log("Set notification state:", state),
};

const meta = {
    title: "Room List/RoomListItem",
    component: RoomListItemView,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <div style={{ width: "320px", border: "1px solid #ccc" }}>
                <Story />
            </div>
        ),
    ],
    args: {
        item: baseItem,
        callbacks: baseCallbacks,
        isSelected: false,
        isFocused: false,
        onFocus: () => {},
        roomIndex: 0,
        roomCount: 10,
        avatar: mockAvatar,
    },
} satisfies Meta<typeof RoomListItemView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithMessagePreview: Story = {
    args: {
        item: {
            ...baseItem,
            messagePreview: "Alice: Hey, are you coming to the meeting?",
        },
    },
};

export const WithUnread: Story = {
    args: {
        item: {
            ...baseItem,
            name: "Team Chat",
            isBold: true,
            a11yLabel: "Team Chat, 3 unread messages",
            notification: mockNotificationData,
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
        item: {
            ...baseItem,
            name: "This is a very long room name that should be truncated with ellipsis when it exceeds the available width",
            messagePreview: "And this is also a very long message preview that should also be truncated",
        },
    },
};

export const BoldWithPreview: Story = {
    args: {
        item: {
            ...baseItem,
            name: "Design Team",
            isBold: true,
            messagePreview: "Bob shared a new design file",
            notification: mockNotificationData,
        },
    },
};

export const AllStates: Story = {
    render: (): React.ReactElement => (
        <div style={{ width: "320px" }}>
            <RoomListItemView
                item={baseItem}
                callbacks={baseCallbacks}
                isSelected={false}
                isFocused={false}
                onFocus={() => {}}
                roomIndex={0}
                roomCount={5}
                avatar={mockAvatar}
            />
            <RoomListItemView
                item={{ ...baseItem, isBold: true, notification: mockNotificationData }}
                callbacks={baseCallbacks}
                isSelected={false}
                isFocused={false}
                onFocus={() => {}}
                roomIndex={1}
                roomCount={5}
                avatar={mockAvatar}
            />
            <RoomListItemView
                item={baseItem}
                callbacks={baseCallbacks}
                isSelected={true}
                isFocused={false}
                onFocus={() => {}}
                roomIndex={2}
                roomCount={5}
                avatar={mockAvatar}
            />
            <RoomListItemView
                item={{ ...baseItem, messagePreview: "Latest message" }}
                callbacks={baseCallbacks}
                isSelected={false}
                isFocused={false}
                onFocus={() => {}}
                roomIndex={3}
                roomCount={5}
                avatar={mockAvatar}
            />
            <RoomListItemView
                item={baseItem}
                callbacks={baseCallbacks}
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

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import { RoomList, type RoomListViewModel, type RoomsResult } from "./RoomList";
import type { RoomListItemViewModel } from "../RoomListItem";
import type { NotificationDecorationViewModel } from "../../notifications/NotificationDecoration";
import type { RoomListItemMenuViewModel } from "../RoomListItem/RoomListItemMenuViewModel";
import { type RoomNotifState } from "../../notifications/RoomNotifs";
import type { Meta, StoryObj } from "@storybook/react-vite";

// Mock avatar component
const mockAvatar = (name: string): React.ReactElement => (
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
            fontSize: "12px",
        }}
    >
        {name.substring(0, 2).toUpperCase()}
    </div>
);

// Generate mock rooms with ViewModels
const generateMockRooms = (count: number): RoomListItemViewModel[] => {
    const mockNotificationViewModel: NotificationDecorationViewModel = {
        hasAnyNotificationOrActivity: false,
        isUnsentMessage: false,
        invited: false,
        isMention: false,
        isActivityNotification: false,
        isNotification: false,
        count: 0,
        muted: false,
    };

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

    return Array.from({ length: count }, (_, i) => {
        const hasUnread = Math.random() > 0.7;
        const unreadCount = hasUnread ? Math.floor(Math.random() * 10) : 0;
        const hasNotification = Math.random() > 0.8;
        const isMention = Math.random() > 0.9;

        const notificationViewModel: NotificationDecorationViewModel = hasUnread
            ? {
                  hasAnyNotificationOrActivity: true,
                  isUnsentMessage: false,
                  invited: false,
                  isMention,
                  isActivityNotification: !hasNotification,
                  isNotification: hasNotification,
                  count: unreadCount,
                  muted: false,
              }
            : mockNotificationViewModel;

        return {
            id: `!room${i}:server`,
            name: `Room ${i + 1}`,
            openRoom: () => console.log(`Opening room: Room ${i + 1}`),
            a11yLabel: unreadCount > 0 ? `Room ${i + 1}, ${unreadCount} unread messages` : `Room ${i + 1}`,
            isBold: unreadCount > 0,
            messagePreview: undefined,
            notificationViewModel,
            menuViewModel: mockMenuViewModel,
        };
    });
};

const mockRoomsResult: RoomsResult = {
    spaceId: "!space:server",
    filterKeys: undefined,
    rooms: generateMockRooms(50),
};

const mockViewModel: RoomListViewModel = {
    roomsResult: mockRoomsResult,
    activeRoomIndex: undefined,
    onKeyDown: undefined,
};

const renderAvatar = (roomViewModel: RoomListItemViewModel): React.ReactElement => {
    return mockAvatar(roomViewModel.name);
};

const meta = {
    title: "Room List/RoomList",
    component: RoomList,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <div style={{ height: "600px", border: "1px solid #ccc" }}>
                <Story />
            </div>
        ),
    ],
    args: {
        viewModel: mockViewModel,
        renderAvatar,
    },
} satisfies Meta<typeof RoomList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSelection: Story = {
    args: {
        viewModel: {
            ...mockViewModel,
            activeRoomIndex: 5,
        },
    },
};

export const SmallList: Story = {
    args: {
        viewModel: {
            ...mockViewModel,
            roomsResult: {
                spaceId: "!space:server",
                filterKeys: undefined,
                rooms: generateMockRooms(5),
            },
        },
    },
};

export const LargeList: Story = {
    args: {
        viewModel: {
            ...mockViewModel,
            roomsResult: {
                spaceId: "!space:server",
                filterKeys: undefined,
                rooms: generateMockRooms(200),
            },
        },
    },
};

export const EmptyList: Story = {
    args: {
        viewModel: {
            ...mockViewModel,
            roomsResult: {
                spaceId: "!space:server",
                filterKeys: undefined,
                rooms: [],
            },
        },
    },
};

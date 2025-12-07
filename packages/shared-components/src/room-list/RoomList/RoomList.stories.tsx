/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import { RoomList, type RoomListViewModel, type RoomListViewSnapshot, type RoomsResult } from "./RoomList";
import type { RoomListItem } from "../RoomListItem";
import type { NotificationDecorationData } from "../../notifications/NotificationDecoration";
import type { MoreOptionsMenuState } from "../RoomListItem/RoomListItemMoreOptionsMenu";
import type { NotificationMenuState } from "../RoomListItem/RoomListItemNotificationMenu";
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

// Generate mock rooms with data
const generateMockRooms = (count: number): RoomListItem[] => {
    const mockNotificationData: NotificationDecorationData = {
        hasAnyNotificationOrActivity: false,
        isUnsentMessage: false,
        invited: false,
        isMention: false,
        isActivityNotification: false,
        isNotification: false,
        muted: false,
    };

    const mockMoreOptionsState: MoreOptionsMenuState = {
        isFavourite: false,
        isLowPriority: false,
        canInvite: true,
        canCopyRoomLink: true,
        canMarkAsRead: true,
        canMarkAsUnread: true,
    };

    const mockNotificationState: NotificationMenuState = {
        isNotificationAllMessage: true,
        isNotificationAllMessageLoud: false,
        isNotificationMentionOnly: false,
        isNotificationMute: false,
    };

    return Array.from({ length: count }, (_, i) => {
        const hasUnread = Math.random() > 0.7;
        const unreadCount = hasUnread ? Math.floor(Math.random() * 10) : 0;
        const hasNotification = Math.random() > 0.8;
        const isMention = Math.random() > 0.9;

        const notificationData: NotificationDecorationData = hasUnread
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
            : mockNotificationData;

        return {
            id: `!room${i}:server`,
            name: `Room ${i + 1}`,
            a11yLabel: unreadCount > 0 ? `Room ${i + 1}, ${unreadCount} unread messages` : `Room ${i + 1}`,
            isBold: unreadCount > 0,
            messagePreview: undefined,
            notification: notificationData,
            showMoreOptionsMenu: true,
            showNotificationMenu: true,
            moreOptionsState: mockMoreOptionsState,
            notificationState: mockNotificationState,
        };
    });
};

const mockRoomsResult: RoomsResult = {
    spaceId: "!space:server",
    filterKeys: undefined,
    rooms: generateMockRooms(50),
};

// Create stable unsubscribe function
const noop = (): void => {};

function createMockViewModel(snapshot: RoomListViewSnapshot): RoomListViewModel {
    return {
        getSnapshot: () => snapshot,
        subscribe: () => noop,
        onOpenRoom: (roomId: string) => console.log("Open room:", roomId),
        onMarkAsRead: (roomId: string) => console.log("Mark as read:", roomId),
        onMarkAsUnread: (roomId: string) => console.log("Mark as unread:", roomId),
        onToggleFavorite: (roomId: string) => console.log("Toggle favorite:", roomId),
        onToggleLowPriority: (roomId: string) => console.log("Toggle low priority:", roomId),
        onInvite: (roomId: string) => console.log("Invite to room:", roomId),
        onCopyRoomLink: (roomId: string) => console.log("Copy room link:", roomId),
        onLeaveRoom: (roomId: string) => console.log("Leave room:", roomId),
        onSetRoomNotifState: (roomId: string, state: RoomNotifState) =>
            console.log("Set notification state:", roomId, state),
    };
}

const mockViewModel: RoomListViewModel = createMockViewModel({
    roomsResult: mockRoomsResult,
    activeRoomIndex: undefined,
});

const renderAvatar = (roomItem: RoomListItem): React.ReactElement => {
    return mockAvatar(roomItem.name);
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
        vm: mockViewModel,
        renderAvatar,
    },
} satisfies Meta<typeof RoomList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {},
};

export const WithSelection: Story = {
    args: {
        vm: createMockViewModel({
            roomsResult: mockRoomsResult,
            activeRoomIndex: 5,
        }),
    },
};

export const SmallList: Story = {
    args: {
        vm: createMockViewModel({
            roomsResult: {
                spaceId: "!space:server",
                filterKeys: undefined,
                rooms: generateMockRooms(5),
            },
            activeRoomIndex: undefined,
        }),
    },
};

export const LargeList: Story = {
    args: {
        vm: createMockViewModel({
            roomsResult: {
                spaceId: "!space:server",
                filterKeys: undefined,
                rooms: generateMockRooms(200),
            },
            activeRoomIndex: undefined,
        }),
    },
};

export const EmptyList: Story = {
    args: {
        vm: createMockViewModel({
            roomsResult: {
                spaceId: "!space:server",
                filterKeys: undefined,
                rooms: [],
            },
            activeRoomIndex: undefined,
        }),
    },
};

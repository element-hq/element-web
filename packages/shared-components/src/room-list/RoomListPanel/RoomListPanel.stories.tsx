/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoomListPanel, type RoomListPanelViewModel } from "./RoomListPanel";
import { type RoomsResult } from "../RoomList";
import { type RoomListItemViewModel } from "../RoomListItem";
import type { NotificationDecorationViewModel } from "../../notifications/NotificationDecoration";
import { SortOption } from "../RoomListHeader/SortOptionsMenu";
import { type FilterViewModel } from "../RoomListPrimaryFilters/useVisibleFilters";

// Mock avatar component
const mockAvatar = (roomViewModel: RoomListItemViewModel): React.ReactElement => (
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
        {roomViewModel.name.substring(0, 2).toUpperCase()}
    </div>
);

// Generate mock rooms
const generateMockRooms = (count: number): RoomListItemViewModel[] => {
    return Array.from({ length: count }, (_, i) => {
        const unreadCount = Math.random() > 0.7 ? Math.floor(Math.random() * 10) : 0;
        const hasNotification = Math.random() > 0.8;

        const notificationViewModel: NotificationDecorationViewModel = {
            hasAnyNotificationOrActivity: unreadCount > 0,
            isUnsentMessage: false,
            invited: false,
            isMention: false,
            isActivityNotification: unreadCount > 0 && !hasNotification,
            isNotification: hasNotification,
            count: unreadCount,
            muted: false,
        };

        return {
            id: `!room${i}:server`,
            name: `Room ${i + 1}`,
            openRoom: () => console.log(`Opening room: Room ${i + 1}`),
            a11yLabel: unreadCount ? `Room ${i + 1}, ${unreadCount} unread messages` : `Room ${i + 1}`,
            isBold: unreadCount > 0,
            messagePreview: undefined,
            notificationViewModel,
            menuViewModel: {
                showMoreOptionsMenu: true,
                showNotificationMenu: true,
                canMarkAsRead: unreadCount > 0,
                canMarkAsUnread: unreadCount === 0,
                isFavourite: false,
                isLowPriority: false,
                canInvite: true,
                canCopyRoomLink: true,
                isNotificationAllMessage: true,
                isNotificationAllMessageLoud: false,
                isNotificationMentionOnly: false,
                isNotificationMute: false,
                markAsRead: () => console.log(`Mark read: Room ${i + 1}`),
                markAsUnread: () => console.log(`Mark unread: Room ${i + 1}`),
                toggleFavorite: () => console.log(`Toggle favorite: Room ${i + 1}`),
                toggleLowPriority: () => console.log(`Toggle low priority: Room ${i + 1}`),
                invite: () => console.log(`Invite: Room ${i + 1}`),
                copyRoomLink: () => console.log(`Copy link: Room ${i + 1}`),
                leaveRoom: () => console.log(`Leave: Room ${i + 1}`),
                setRoomNotifState: (state) => console.log(`Set notif state: ${state}`),
            },
        };
    });
};

const mockRoomsResult: RoomsResult = {
    spaceId: "!space:server",
    filterKeys: undefined,
    rooms: generateMockRooms(20),
};

// Create mock filters
const createFilters = (): FilterViewModel[] => {
    const filters = ["All", "People", "Rooms", "Favourites", "Unread"];
    return filters.map((name, index) => ({
        name,
        active: index === 0,
        toggle: () => console.log(`Filter: ${name}`),
    }));
};

const meta: Meta<typeof RoomListPanel> = {
    title: "Room List/RoomListPanel",
    component: RoomListPanel,
    tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof RoomListPanel>;

const baseViewModel: RoomListPanelViewModel = {
    ariaLabel: "Room list navigation",
    searchViewModel: {
        onSearchClick: () => console.log("Open search"),
        showDialPad: false,
        showExplore: true,
        onExploreClick: () => console.log("Explore rooms"),
    },
    headerViewModel: {
        title: "Home",
        isSpace: false,
        displayComposeMenu: false,
        onComposeClick: () => console.log("Compose"),
        sortOptionsMenuViewModel: {
            activeSortOption: SortOption.Activity,
            sort: (option) => console.log(`Sort: ${option}`),
        },
    },
    viewViewModel: {
        isLoadingRooms: false,
        isRoomListEmpty: false,
        filtersViewModel: {
            filters: createFilters(),
        },
        roomListViewModel: {
            roomsResult: mockRoomsResult,
            activeRoomIndex: 0,
        },
        emptyStateTitle: "No rooms",
        emptyStateDescription: "Join a room to get started",
    },
};

export const Default: Story = {
    args: {
        viewModel: baseViewModel,
        renderAvatar: mockAvatar,
    },
    decorators: [
        (Story) => (
            <div style={{ height: "600px", width: "320px" }}>
                <Story />
            </div>
        ),
    ],
};

export const WithoutSearch: Story = {
    args: {
        viewModel: {
            ...baseViewModel,
            searchViewModel: undefined,
        },
        renderAvatar: mockAvatar,
    },
    decorators: [
        (Story) => (
            <div style={{ height: "600px", width: "320px" }}>
                <Story />
            </div>
        ),
    ],
};

export const Loading: Story = {
    args: {
        viewModel: {
            ...baseViewModel,
            viewViewModel: {
                ...baseViewModel.viewViewModel,
                isLoadingRooms: true,
            },
        },
        renderAvatar: mockAvatar,
    },
    decorators: [
        (Story) => (
            <div style={{ height: "600px", width: "320px" }}>
                <Story />
            </div>
        ),
    ],
};

export const Empty: Story = {
    args: {
        viewModel: {
            ...baseViewModel,
            viewViewModel: {
                ...baseViewModel.viewViewModel,
                isRoomListEmpty: true,
                emptyStateTitle: "No rooms to display",
                emptyStateDescription: "Join a room or start a conversation to get started",
            },
        },
        renderAvatar: mockAvatar,
    },
    decorators: [
        (Story) => (
            <div style={{ height: "600px", width: "320px" }}>
                <Story />
            </div>
        ),
    ],
};

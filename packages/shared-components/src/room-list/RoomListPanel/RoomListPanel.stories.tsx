/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { NotificationDecorationData } from "../../notifications/NotificationDecoration";
import type { RoomsResult } from "../RoomList";
import type { RoomListItem } from "../RoomListItem";
import type { MoreOptionsMenuState } from "../RoomListItem/RoomListItemMoreOptionsMenu";
import type { NotificationMenuState } from "../RoomListItem/RoomListItemNotificationMenu";
import { SortOption } from "../RoomListHeader/SortOptionsMenu";
import { RoomListPanel, type RoomListPanelSnapshot } from "./RoomListPanel";
import type { FilterViewModel } from "../RoomListPrimaryFilters/useVisibleFilters";
import { type ViewModel } from "../../viewmodel/ViewModel";
import type { RoomListSearchSnapshot } from "../RoomListSearch";
import type { RoomListHeaderSnapshot, SortOptionsMenuSnapshot } from "../RoomListHeader";
import type { RoomListViewWrapperSnapshot } from "../RoomListView";
import type { RoomListPrimaryFiltersSnapshot } from "../RoomListPrimaryFilters";

// Mock avatar component
const mockAvatar = (roomItem: RoomListItem): React.ReactElement => (
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
        {roomItem.name.substring(0, 2).toUpperCase()}
    </div>
);

// Generate mock rooms
const generateMockRooms = (count: number): RoomListItem[] => {
    return Array.from({ length: count }, (_, i) => {
        const unreadCount = Math.random() > 0.7 ? Math.floor(Math.random() * 10) : 0;
        const hasNotification = Math.random() > 0.8;

        const notificationData: NotificationDecorationData = {
            hasAnyNotificationOrActivity: unreadCount > 0,
            isUnsentMessage: false,
            invited: false,
            isMention: false,
            isActivityNotification: unreadCount > 0 && !hasNotification,
            isNotification: hasNotification,
            count: unreadCount,
            muted: false,
        };

        const moreOptionsState: MoreOptionsMenuState = {
            isFavourite: false,
            isLowPriority: false,
            canInvite: true,
            canCopyRoomLink: true,
            canMarkAsRead: unreadCount > 0,
            canMarkAsUnread: unreadCount === 0,
        };

        const notificationState: NotificationMenuState = {
            isNotificationAllMessage: true,
            isNotificationAllMessageLoud: false,
            isNotificationMentionOnly: false,
            isNotificationMute: false,
        };

        return {
            id: `!room${i}:server`,
            name: `Room ${i + 1}`,
            a11yLabel: unreadCount ? `Room ${i + 1}, ${unreadCount} unread messages` : `Room ${i + 1}`,
            isBold: unreadCount > 0,
            messagePreview: undefined,
            notification: notificationData,
            showMoreOptionsMenu: true,
            showNotificationMenu: true,
            moreOptionsState,
            notificationState,
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

// Create stable unsubscribe function
const noop = (): void => {};

function createMockViewModel<T>(snapshot: T): ViewModel<T> {
    return {
        getSnapshot: () => snapshot,
        subscribe: () => noop,
    };
}

// Create stable snapshot for RoomListViewModel
const mockRoomListSnapshot = {
    roomsResult: mockRoomsResult,
    activeRoomIndex: 0,
};

// Create stable RoomListViewModel
const mockRoomListViewModel = {
    getSnapshot: () => mockRoomListSnapshot,
    subscribe: () => noop,
    onOpenRoom: (roomId: string) => console.log("Open room:", roomId),
    onMarkAsRead: (roomId: string) => console.log("Mark as read:", roomId),
    onMarkAsUnread: (roomId: string) => console.log("Mark as unread:", roomId),
    onToggleFavorite: (roomId: string) => console.log("Toggle favorite:", roomId),
    onToggleLowPriority: (roomId: string) => console.log("Toggle low priority:", roomId),
    onInvite: (roomId: string) => console.log("Invite:", roomId),
    onCopyRoomLink: (roomId: string) => console.log("Copy room link:", roomId),
    onLeaveRoom: (roomId: string) => console.log("Leave room:", roomId),
    onSetRoomNotifState: (roomId: string, state: any) => console.log("Set notification:", roomId, state),
};

const baseViewModel: ViewModel<RoomListPanelSnapshot> = createMockViewModel({
    ariaLabel: "Room list navigation",
    searchVm: createMockViewModel<RoomListSearchSnapshot>({
        onSearchClick: () => console.log("Open search"),
        showDialPad: false,
        showExplore: true,
        onExploreClick: () => console.log("Explore rooms"),
    }),
    headerVm: createMockViewModel<RoomListHeaderSnapshot>({
        title: "Home",
        isSpace: false,
        displayComposeMenu: false,
        onComposeClick: () => console.log("Compose"),
        sortOptionsMenuVm: createMockViewModel<SortOptionsMenuSnapshot>({
            activeSortOption: SortOption.Activity,
            sort: (option) => console.log(`Sort: ${option}`),
        }),
    }),
    viewVm: createMockViewModel<RoomListViewWrapperSnapshot>({
        isLoadingRooms: false,
        isRoomListEmpty: false,
        filtersVm: createMockViewModel<RoomListPrimaryFiltersSnapshot>({
            filters: createFilters(),
        }),
        roomListVm: mockRoomListViewModel,
        emptyStateTitle: "No rooms",
        emptyStateDescription: "Join a room to get started",
    }),
});

export const Default: Story = {
    args: {
        vm: baseViewModel,
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
        vm: createMockViewModel<RoomListPanelSnapshot>({
            ariaLabel: "Room list navigation",
            searchVm: undefined,
            headerVm: baseViewModel.getSnapshot().headerVm,
            viewVm: baseViewModel.getSnapshot().viewVm,
        }),
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
        vm: createMockViewModel<RoomListPanelSnapshot>({
            ariaLabel: "Room list navigation",
            searchVm: baseViewModel.getSnapshot().searchVm,
            headerVm: baseViewModel.getSnapshot().headerVm,
            viewVm: createMockViewModel<RoomListViewWrapperSnapshot>({
                ...baseViewModel.getSnapshot().viewVm.getSnapshot(),
                isLoadingRooms: true,
            }),
        }),
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
        vm: createMockViewModel<RoomListPanelSnapshot>({
            ariaLabel: "Room list navigation",
            searchVm: baseViewModel.getSnapshot().searchVm,
            headerVm: baseViewModel.getSnapshot().headerVm,
            viewVm: createMockViewModel<RoomListViewWrapperSnapshot>({
                ...baseViewModel.getSnapshot().viewVm.getSnapshot(),
                isRoomListEmpty: true,
                emptyStateTitle: "No rooms to display",
                emptyStateDescription: "Join a room or start a conversation to get started",
            }),
        }),
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

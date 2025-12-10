/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import type { NotificationDecorationData } from "../../notifications/NotificationDecoration";
import type { RoomListItem } from "../RoomListItem";
import type { MoreOptionsMenuState } from "../RoomListItem/RoomListItemMoreOptionsMenu";
import type { NotificationMenuState } from "../RoomListItem/RoomListItemNotificationMenu";
import { SortOption } from "../RoomListHeader/SortOptionsMenu";
import { RoomListPanel } from "./RoomListPanel";
import type { Filter } from "../RoomListPrimaryFilters/useVisibleFilters";
import type { RoomListSnapshot, RoomListViewModel, RoomListHeaderState } from "../RoomListView";

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

// Create mock filters
const createFilters = (): Filter[] => {
    const filters = ["All", "People", "Rooms", "Favourites", "Unread"];
    return filters.map((name, index) => ({
        name,
        active: index === 0,
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

// Create mock ViewModel with public methods
function createMockViewModel(snapshot: RoomListSnapshot): RoomListViewModel {
    return {
        getSnapshot: () => snapshot,
        subscribe: () => noop,
        // Public properties
        showDialPad: false,
        showExplore: false,
        // Public callback methods
        onToggleFilter: () => {},
        onSearchClick: () => {},
        onDialPadClick: () => {},
        onExploreClick: () => {},
        onComposeClick: () => {},
        openSpaceHome: () => {},
        inviteInSpace: () => {},
        openSpacePreferences: () => {},
        openSpaceSettings: () => {},
        createChatRoom: () => {},
        createRoom: () => {},
        createVideoRoom: () => {},
        sort: () => {},
        onOpenRoom: () => {},
        onMarkAsRead: () => {},
        onMarkAsUnread: () => {},
        onToggleFavorite: () => {},
        onToggleLowPriority: () => {},
        onInvite: () => {},
        onCopyRoomLink: () => {},
        onLeaveRoom: () => {},
        onSetRoomNotifState: () => {},
    };
}

const baseHeaderState: RoomListHeaderState = {
    title: "Home",
    isSpace: false,
    displayComposeMenu: false,
    activeSortOption: SortOption.Activity,
};

const baseSnapshot: RoomListSnapshot = {
    headerState: baseHeaderState,
    isLoadingRooms: false,
    isRoomListEmpty: false,
    filters: createFilters(),
    roomListState: {
        rooms: generateMockRooms(20),
    },
    emptyStateDescription: "Join a room to get started",
};

export const Default: Story = {
    args: {
        vm: createMockViewModel(baseSnapshot),
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
        vm: createMockViewModel({
            ...baseSnapshot,
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
        vm: createMockViewModel({
            ...baseSnapshot,
            isLoadingRooms: true,
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
        vm: createMockViewModel({
            ...baseSnapshot,
            isRoomListEmpty: true,
            roomListState: {
                rooms: [],
            },
            emptyStateDescription: "Join a room or start a conversation to get started",
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

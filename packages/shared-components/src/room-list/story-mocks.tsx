/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fn } from "storybook/test";

import { type Room, type RoomListItemSnapshot, RoomNotifState } from "./RoomListItemView";

/**
 * Mock avatar component for stories
 */
export const mockAvatar = (name: string): React.ReactElement => (
    <div
        role="img"
        aria-label={`${name} avatar`}
        style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            backgroundColor: "#0B7F67",
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

/**
 * Render avatar function for stories
 */
export const renderAvatar = (room: Room): React.ReactElement => {
    // Cast to any to access properties - in real usage, the room object from the SDK will have these
    return mockAvatar((room as any)?.name || "Room");
};

/**
 * Room names used for mock data
 */
const roomNames = [
    "General",
    "Random",
    "Engineering",
    "Design",
    "Product",
    "Marketing",
    "Sales",
    "Support",
    "Announcements",
    "Off-topic",
    "Team Alpha",
    "Team Beta",
    "Project X",
    "Project Y",
    "Water Cooler",
    "Feedback",
    "Ideas",
    "Bugs",
    "Features",
    "Releases",
];

/**
 * Create a mock room item snapshot for stories
 */
export const createMockRoomSnapshot = (id: string, name: string, index: number): RoomListItemSnapshot => ({
    id,
    room: { name },
    name,
    isBold: index % 3 === 0,
    messagePreview: index % 2 === 0 ? `Last message in ${name}` : undefined,
    notification: {
        hasAnyNotificationOrActivity: index % 5 === 0,
        isUnsentMessage: false,
        invited: false,
        isMention: index % 5 === 0,
        isActivityNotification: false,
        isNotification: index % 5 === 0,
        hasUnreadCount: index % 5 === 0,
        count: index % 5 === 0 ? index : 0,
        muted: false,
    },
    showMoreOptionsMenu: true,
    showNotificationMenu: true,
    isFavourite: false,
    isLowPriority: false,
    canInvite: true,
    canCopyRoomLink: true,
    canMarkAsRead: false,
    canMarkAsUnread: true,
    roomNotifState: RoomNotifState.AllMessages,
});

/**
 * Create a mock getRoomItemViewModel function for stories
 */
export const createGetRoomItemViewModel = (roomIds: string[]): ((roomId: string) => any) => {
    const viewModels = new Map();
    roomIds.forEach((roomId, index) => {
        const name = roomNames[index % roomNames.length];
        const snapshot = createMockRoomSnapshot(roomId, name, index);

        const mockViewModel = {
            getSnapshot: () => snapshot,
            subscribe: fn(),
            unsubscribe: fn(),
            onOpenRoom: fn(),
            onMarkAsRead: fn(),
            onMarkAsUnread: fn(),
            onToggleFavorite: fn(),
            onToggleLowPriority: fn(),
            onInvite: fn(),
            onCopyRoomLink: fn(),
            onLeaveRoom: fn(),
            onSetRoomNotifState: fn(),
        };
        viewModels.set(roomId, mockViewModel);
    });

    return (roomId: string) => viewModels.get(roomId);
};

/**
 * Mock room IDs for different list sizes
 */
export const mockRoomIds = Array.from({ length: 20 }, (_, i) => `!room${i}:server`);
export const smallListRoomIds = mockRoomIds.slice(0, 5);
export const largeListRoomIds = Array.from({ length: 100 }, (_, i) => `!room${i}:server`);

/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type RoomListItemSnapshot } from "./RoomListItemView";
import { RoomNotifState } from "./RoomNotifs";

export const mockRoom = { name: "General" };

export const defaultSnapshot: RoomListItemSnapshot = {
    id: "!room:server",
    room: mockRoom,
    name: "General",
    isBold: false,
    messagePreview: "Alice: Hey everyone!",
    notification: {
        hasAnyNotificationOrActivity: false,
        isUnsentMessage: false,
        invited: false,
        isMention: false,
        isActivityNotification: false,
        isNotification: false,
        hasUnreadCount: false,
        count: 0,
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
};

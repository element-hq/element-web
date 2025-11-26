/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type RoomNotifState } from "../../notifications/RoomNotifs";

/**
 * ViewModel interface for room list item menus (hover menu and context menu).
 * Contains all the data and callbacks needed to render the menu options.
 */
export interface RoomListItemMenuViewModel {
    /** Whether the more options menu should be shown */
    showMoreOptionsMenu: boolean;
    /** Whether the notification menu should be shown */
    showNotificationMenu: boolean;
    /** Whether the room is a favourite room */
    isFavourite: boolean;
    /** Whether the room is a low priority room */
    isLowPriority: boolean;
    /** Can invite other users in the room */
    canInvite: boolean;
    /** Can copy the room link */
    canCopyRoomLink: boolean;
    /** Can mark the room as read */
    canMarkAsRead: boolean;
    /** Can mark the room as unread */
    canMarkAsUnread: boolean;
    /** Whether the notification is set to all messages */
    isNotificationAllMessage: boolean;
    /** Whether the notification is set to all messages loud */
    isNotificationAllMessageLoud: boolean;
    /** Whether the notification is set to mentions and keywords only */
    isNotificationMentionOnly: boolean;
    /** Whether the notification is muted */
    isNotificationMute: boolean;
    /** Mark the room as read */
    markAsRead: () => void;
    /** Mark the room as unread */
    markAsUnread: () => void;
    /** Toggle the room as favourite */
    toggleFavorite: () => void;
    /** Toggle the room as low priority */
    toggleLowPriority: () => void;
    /** Invite other users in the room */
    invite: () => void;
    /** Copy the room link to clipboard */
    copyRoomLink: () => void;
    /** Leave the room */
    leaveRoom: () => void;
    /** Set the room notification state */
    setRoomNotifState: (state: RoomNotifState) => void;
}

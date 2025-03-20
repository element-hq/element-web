/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";

import { useUnreadNotifications } from "../../../hooks/useUnreadNotifications";
import { NotificationLevel } from "../../../stores/notifications/NotificationLevel";
import { useSettingValue } from "../../../hooks/useSettings";
import { formatCount } from "../../../utils/FormattingUtils";

export interface NotificationDecorationViewState {
    /**
     * True if the decoration should be hidden.
     */
    hide: boolean;
    /**
     * True if the decoration is for an unsent message.
     */
    isMessageNotSent: boolean;
    /**
     * True if the decoration is an invitation.
     * This is a special case of a highlight notification and is exclusive with isHighlighted and hasUnread.
     */
    isInvite: boolean;
    /**
     * True if the decoration is highlighted.
     */
    isHighlighted: boolean;
    /**
     * True if the decoration is a dot. (Activity)
     */
    isDot: boolean;
    /**
     * True if the room has unread messages.
     */
    hasUnread: boolean;
    /**
     * The raw unread count.
     */
    rawUnreadCount: number;
    /**
     * The formatted unread count.
     */
    unreadCount: string;
}

/**
 * View model for the notification decoration.
 */
export function useNotificationDecorationViewModel(room: Room, threadId?: string): NotificationDecorationViewState {
    const { level, count, symbol } = useUnreadNotifications(room, threadId);
    const hideBold = useSettingValue("feature_hidebold");

    // Hide the decoration if the level is None or if the level is Activity and we hide activity notification
    const hide = level <= NotificationLevel.None || (hideBold && level <= NotificationLevel.Activity);
    // Error when sending a message
    const isMessageNotSent = level === NotificationLevel.Unsent;
    // Invite notification is an Highlight notification with a count of 1 and the "!" symbol
    const isInvite = Boolean(symbol === "!" && count === 1 && level === NotificationLevel.Highlight);
    // Regular highlight notification
    const isHighlighted = !isInvite && level === NotificationLevel.Highlight;
    // Regular activity notification
    const isDot = level <= NotificationLevel.Activity;
    // Is unread notification if it's not an invite and the level is between Notification and Highlight
    const hasUnread =
        !isInvite && level >= NotificationLevel.Notification && level <= NotificationLevel.Highlight && count > 0;
    // Format for better readability
    const unreadCount = formatCount(count);

    // Video room and call notifications will be added here

    return {
        hide,
        isMessageNotSent,
        isInvite,
        isHighlighted,
        isDot,
        hasUnread,
        rawUnreadCount: count,
        unreadCount,
    };
}

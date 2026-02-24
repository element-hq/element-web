/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import {
    MentionIcon,
    ErrorSolidIcon,
    NotificationsOffSolidIcon,
    VideoCallSolidIcon,
    EmailSolidIcon,
    VoiceCallSolidIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { UnreadCounter, Unread } from "@vector-im/compound-web";

import { Flex } from "../../../utils/Flex";

/**
 * Data representing the notification state for a room or item.
 * Used in snapshots and passed to the NotificationDecoration component.
 */
export interface NotificationDecorationData {
    /** Whether there is any notification or activity to display */
    hasAnyNotificationOrActivity: boolean;
    /** Whether there's an unsent message */
    isUnsentMessage: boolean;
    /** Whether the user is invited to the room */
    invited: boolean;
    /** Whether the notification is a mention */
    isMention: boolean;
    /** Whether there's activity (not a full notification) */
    isActivityNotification: boolean;
    /** Whether there's a notification (not just activity) */
    isNotification: boolean;
    /** Whether there are unread messages with a count */
    hasUnreadCount: boolean;
    /** Notification count */
    count: number;
    /** Whether notifications are muted */
    muted: boolean;
    /** Optional call type indicator */
    callType?: "video" | "voice";
}

/**
 * Props for the NotificationDecoration component.
 */
export interface NotificationDecorationProps extends NotificationDecorationData {}

/**
 * Renders notification badges and indicators for rooms/items
 */
export const NotificationDecoration: React.FC<NotificationDecorationProps> = ({
    hasAnyNotificationOrActivity,
    muted,
    callType,
    isUnsentMessage,
    invited,
    isMention,
    isNotification,
    isActivityNotification,
    count,
}) => {
    // Don't render anything if there's nothing to show
    if (!hasAnyNotificationOrActivity && !muted && !callType) {
        return null;
    }

    return (
        <Flex align="center" justify="center" gap="var(--cpd-space-1x)" data-testid="notification-decoration">
            {isUnsentMessage && (
                <ErrorSolidIcon width="20px" height="20px" fill="var(--cpd-color-icon-critical-primary)" />
            )}
            {callType === "video" && (
                <VideoCallSolidIcon width="20px" height="20px" fill="var(--cpd-color-icon-accent-primary)" />
            )}
            {callType === "voice" && (
                <VoiceCallSolidIcon width="20px" height="20px" fill="var(--cpd-color-icon-accent-primary)" />
            )}
            {invited && <EmailSolidIcon width="20px" height="20px" fill="var(--cpd-color-icon-accent-primary)" />}
            {isMention && <MentionIcon width="20px" height="20px" fill="var(--cpd-color-icon-accent-primary)" />}
            {(isMention || isNotification) && <UnreadCounter count={count || null} />}
            {isActivityNotification && <Unread />}
            {muted && <NotificationsOffSolidIcon width="20px" height="20px" fill="var(--cpd-color-icon-tertiary)" />}
        </Flex>
    );
};

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type HTMLProps, type JSX } from "react";
import MentionIcon from "@vector-im/compound-design-tokens/assets/web/icons/mention";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error";
import NotificationOffIcon from "@vector-im/compound-design-tokens/assets/web/icons/notifications-off-solid";
import { UnreadCounter, Unread } from "@vector-im/compound-web";

import { Flex } from "../../utils/Flex";
import { type RoomNotificationState } from "../../../stores/notifications/RoomNotificationState";

interface NotificationDecorationProps extends HTMLProps<HTMLDivElement> {
    /**
     * The notification state of the room or thread.
     */
    notificationState: RoomNotificationState;
}

/**
 * Displays the notification decoration for a room or a thread.
 */
export function NotificationDecoration({
    notificationState,
    ...props
}: NotificationDecorationProps): JSX.Element | null {
    const {
        hasAnyNotificationOrActivity,
        isUnsetMessage,
        invited,
        isMention,
        isActivityNotification,
        isNotification,
        count,
        muted,
    } = notificationState;
    if (!hasAnyNotificationOrActivity && !muted) return null;

    return (
        <Flex
            align="center"
            justify="center"
            gap="var(--cpd-space-1-5x)"
            {...props}
            data-testid="notification-decoration"
        >
            {isUnsetMessage && <ErrorIcon width="20px" height="20px" fill="var(--cpd-color-icon-critical-primary)" />}
            {invited && <UnreadCounter count={1} />}
            {isMention && <MentionIcon width="20px" height="20px" fill="var(--cpd-color-icon-accent-primary)" />}
            {(isMention || isNotification) && <UnreadCounter count={count || null} />}
            {isActivityNotification && <Unread />}
            {muted && <NotificationOffIcon width="20px" height="20px" fill="var(--cpd-color-icon-tertiary)" />}
        </Flex>
    );
}

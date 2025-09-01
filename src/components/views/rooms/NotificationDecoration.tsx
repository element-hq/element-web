/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type HTMLProps, type JSX } from "react";
import MentionIcon from "@vector-im/compound-design-tokens/assets/web/icons/mention";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error-solid";
import NotificationOffIcon from "@vector-im/compound-design-tokens/assets/web/icons/notifications-off-solid";
import VideoCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call-solid";
import EmailIcon from "@vector-im/compound-design-tokens/assets/web/icons/email-solid";
import { UnreadCounter, Unread } from "@vector-im/compound-web";

import { Flex } from "../../../shared-components/utils/Flex";
import { type RoomNotificationState } from "../../../stores/notifications/RoomNotificationState";
import { useTypedEventEmitterState } from "../../../hooks/useEventEmitter";
import { NotificationStateEvents } from "../../../stores/notifications/NotificationState";

interface NotificationDecorationProps extends HTMLProps<HTMLDivElement> {
    /**
     * The notification state of the room or thread.
     */
    notificationState: RoomNotificationState;
    /**
     * Whether the room has a video call.
     */
    hasVideoCall: boolean;
}

/**
 * Displays the notification decoration for a room or a thread.
 */
export function NotificationDecoration({
    notificationState,
    hasVideoCall,
    ...props
}: NotificationDecorationProps): JSX.Element | null {
    // Listen to the notification state and update the component when it changes
    const {
        hasAnyNotificationOrActivity,
        isUnsentMessage,
        invited,
        isMention,
        isActivityNotification,
        isNotification,
        count,
        muted,
    } = useTypedEventEmitterState(notificationState, NotificationStateEvents.Update, () => ({
        hasAnyNotificationOrActivity: notificationState.hasAnyNotificationOrActivity,
        isUnsentMessage: notificationState.isUnsentMessage,
        invited: notificationState.invited,
        isMention: notificationState.isMention,
        isActivityNotification: notificationState.isActivityNotification,
        isNotification: notificationState.isNotification,
        count: notificationState.count,
        muted: notificationState.muted,
    }));

    if (!hasAnyNotificationOrActivity && !muted && !hasVideoCall) return null;

    return (
        <Flex
            align="center"
            justify="center"
            gap="var(--cpd-space-1x)"
            {...props}
            data-testid="notification-decoration"
        >
            {isUnsentMessage && <ErrorIcon width="20px" height="20px" fill="var(--cpd-color-icon-critical-primary)" />}
            {hasVideoCall && <VideoCallIcon width="20px" height="20px" fill="var(--cpd-color-icon-accent-primary)" />}
            {invited && <EmailIcon width="20px" height="20px" fill="var(--cpd-color-icon-accent-primary)" />}
            {isMention && <MentionIcon width="20px" height="20px" fill="var(--cpd-color-icon-accent-primary)" />}
            {(isMention || isNotification) && <UnreadCounter count={count || null} />}
            {isActivityNotification && <Unread />}
            {muted && <NotificationOffIcon width="20px" height="20px" fill="var(--cpd-color-icon-tertiary)" />}
        </Flex>
    );
}

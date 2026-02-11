/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type HTMLProps, type JSX } from "react";
import {
    MentionIcon,
    ErrorIcon,
    NotificationsOffSolidIcon,
    VideoCallSolidIcon,
    EmailSolidIcon,
    VoiceCallSolidIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { UnreadCounter, Unread } from "@vector-im/compound-web";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { Flex } from "@element-hq/web-shared-components";

import { type RoomNotificationState } from "../../../stores/notifications/RoomNotificationState";
import { useTypedEventEmitterState } from "../../../hooks/useEventEmitter";
import { NotificationStateEvents } from "../../../stores/notifications/NotificationState";

interface NotificationDecorationProps extends HTMLProps<HTMLDivElement> {
    /**
     * The notification state of the room or thread.
     */
    notificationState: RoomNotificationState;
    /**
     * Whether the room has a voice or video call.
     */
    callType?: CallType;
}

/**
 * Displays the notification decoration for a room or a thread.
 */
export function NotificationDecoration({
    notificationState,
    callType,
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

    if (!hasAnyNotificationOrActivity && !muted && !callType) return null;

    return (
        <Flex
            align="center"
            justify="center"
            gap="var(--cpd-space-1x)"
            {...props}
            data-testid="notification-decoration"
        >
            {isUnsentMessage && <ErrorIcon width="20px" height="20px" fill="var(--cpd-color-icon-critical-primary)" />}
            {callType === CallType.Video && (
                <VideoCallSolidIcon width="20px" height="20px" fill="var(--cpd-color-icon-accent-primary)" />
            )}
            {callType === CallType.Voice && (
                <VoiceCallSolidIcon width="20px" height="20px" fill="var(--cpd-color-icon-accent-primary)" />
            )}
            {invited && <EmailSolidIcon width="20px" height="20px" fill="var(--cpd-color-icon-accent-primary)" />}
            {isMention && <MentionIcon width="20px" height="20px" fill="var(--cpd-color-icon-accent-primary)" />}
            {(isMention || isNotification) && <UnreadCounter count={count || null} />}
            {isActivityNotification && <Unread />}
            {muted && <NotificationsOffSolidIcon width="20px" height="20px" fill="var(--cpd-color-icon-tertiary)" />}
        </Flex>
    );
}

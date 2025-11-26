/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import MentionIcon from "@vector-im/compound-design-tokens/assets/web/icons/mention";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error-solid";
import NotificationOffIcon from "@vector-im/compound-design-tokens/assets/web/icons/notifications-off-solid";
import VideoCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call-solid";
import EmailIcon from "@vector-im/compound-design-tokens/assets/web/icons/email-solid";
import VoiceCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/voice-call-solid";
import { UnreadCounter, Unread } from "@vector-im/compound-web";

import { Flex } from "../../utils/Flex";

/**
 * ViewModel representing the notification state for a room or item
 */
export interface NotificationDecorationViewModel {
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
    /** Notification count */
    count: number;
    /** Whether notifications are muted */
    muted: boolean;
    /** Optional call type indicator */
    callType?: "video" | "voice";
}

export interface NotificationDecorationProps {
    /** ViewModel containing notification state */
    viewModel: NotificationDecorationViewModel;
}

/**
 * Renders notification badges and indicators for rooms/items
 */
export const NotificationDecoration: React.FC<NotificationDecorationProps> = ({ viewModel }) => {
    // Don't render anything if there's nothing to show
    if (!viewModel.hasAnyNotificationOrActivity && !viewModel.muted && !viewModel.callType) {
        return null;
    }

    return (
        <Flex align="center" justify="center" gap="var(--cpd-space-1x)" data-testid="notification-decoration">
            {viewModel.isUnsentMessage && (
                <ErrorIcon width="20px" height="20px" fill="var(--cpd-color-icon-critical-primary)" />
            )}
            {viewModel.callType === "video" && (
                <VideoCallIcon width="20px" height="20px" fill="var(--cpd-color-icon-accent-primary)" />
            )}
            {viewModel.callType === "voice" && (
                <VoiceCallIcon width="20px" height="20px" fill="var(--cpd-color-icon-accent-primary)" />
            )}
            {viewModel.invited && <EmailIcon width="20px" height="20px" fill="var(--cpd-color-icon-accent-primary)" />}
            {viewModel.isMention && (
                <MentionIcon width="20px" height="20px" fill="var(--cpd-color-icon-accent-primary)" />
            )}
            {(viewModel.isMention || viewModel.isNotification) && <UnreadCounter count={viewModel.count || null} />}
            {viewModel.isActivityNotification && <Unread />}
            {viewModel.muted && (
                <NotificationOffIcon width="20px" height="20px" fill="var(--cpd-color-icon-tertiary)" />
            )}
        </Flex>
    );
};

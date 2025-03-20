/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import MentionIcon from "@vector-im/compound-design-tokens/assets/web/icons/mention";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error";
import { UnreadCounter, Unread } from "@vector-im/compound-web";

import { type NotificationDecorationViewState } from "../../../viewmodels/notification_decoration/NotificationDecorationViewModel";
import { Flex } from "../../../utils/Flex";

interface NotificationDecorationProps {
    /**
     * The view model for the notification decoration.
     */
    vm: NotificationDecorationViewState;
}

/**
 * Displays the notification decoration for a room or a thread.
 * If you don't need the NotificationDecorationViewState outside of this component, you should use {@link NotificationDecorationView} instead.
 */
export function NotificationDecoration({ vm }: NotificationDecorationProps): JSX.Element | null {
    const { hide, isMessageNotSent, isInvite, isHighlighted, isDot, hasUnread, unreadCount } = vm;
    if (hide) return null;

    return (
        <Flex align="center" justify="center" gap="var(--cpd-space-1x)">
            {isMessageNotSent && <ErrorIcon width="20px" height="20px" fill="var(--cpd-color-icon-critical-primary)" />}
            {isInvite && <UnreadCounter count={1} />}
            {isHighlighted && <MentionIcon width="20px" height="20px" fill="var(--cpd-color-icon-accent-primary)" />}
            {hasUnread && <UnreadCounter count={unreadCount} />}
            {isDot && <Unread />}
        </Flex>
    );
}

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import { Flex } from "../../utils/Flex";
import {
    RoomListItemMoreOptionsMenu,
    type MoreOptionsMenuState,
    type MoreOptionsMenuCallbacks,
} from "./RoomListItemMoreOptionsMenu";
import {
    RoomListItemNotificationMenu,
    type NotificationMenuState,
} from "./RoomListItemNotificationMenu";
import { type RoomNotifState } from "../../notifications/RoomNotifs";

/**
 * Props for RoomListItemHoverMenu component
 */
export interface RoomListItemHoverMenuProps {
    /** Whether the more options menu should be shown */
    showMoreOptionsMenu: boolean;
    /** Whether the notification menu should be shown */
    showNotificationMenu: boolean;
    /** More options menu state */
    moreOptionsState: MoreOptionsMenuState;
    /** More options menu callbacks */
    moreOptionsCallbacks: MoreOptionsMenuCallbacks;
    /** Notification menu state */
    notificationState: NotificationMenuState;
    /** Callback to set room notification state */
    onSetRoomNotifState: (state: RoomNotifState) => void;
    /** Callback when menu open state changes */
    onMenuOpenChange: (isOpen: boolean) => void;
}

/**
 * The hover menu for room list items.
 * Displays more options and notification settings menus.
 */
export const RoomListItemHoverMenu: React.FC<RoomListItemHoverMenuProps> = ({
    showMoreOptionsMenu,
    showNotificationMenu,
    moreOptionsState,
    moreOptionsCallbacks,
    notificationState,
    onSetRoomNotifState,
    onMenuOpenChange,
}): JSX.Element => {
    return (
        <Flex className="mx_RoomListItemHoverMenu" align="center" gap="var(--cpd-space-1x)">
            {showMoreOptionsMenu && (
                <RoomListItemMoreOptionsMenu
                    state={moreOptionsState}
                    callbacks={moreOptionsCallbacks}
                    onMenuOpenChange={onMenuOpenChange}
                />
            )}
            {showNotificationMenu && (
                <RoomListItemNotificationMenu
                    state={notificationState}
                    onSetRoomNotifState={onSetRoomNotifState}
                    onMenuOpenChange={onMenuOpenChange}
                />
            )}
        </Flex>
    );
};

// Re-export types for convenience
export type { MoreOptionsMenuState, MoreOptionsMenuCallbacks } from "./RoomListItemMoreOptionsMenu";
export type { NotificationMenuState } from "./RoomListItemNotificationMenu";
export type { RoomNotifState } from "../../notifications/RoomNotifs";

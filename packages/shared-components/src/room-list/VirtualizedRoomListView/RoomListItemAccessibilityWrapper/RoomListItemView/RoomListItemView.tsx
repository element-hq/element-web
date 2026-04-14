/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, memo, useEffect, useRef, type ReactNode } from "react";
import classNames from "classnames";
import { Text } from "@vector-im/compound-web";

import { Flex } from "../../../../core/utils/Flex";
import { NotificationDecoration, type NotificationDecorationData } from "./NotificationDecoration";
import { RoomListItemHoverMenu } from "./RoomListItemHoverMenu";
import { RoomListItemContextMenu } from "./RoomListItemContextMenu";
import { type RoomNotifState } from "./RoomNotifs";
import styles from "./RoomListItemView.module.css";
import { useViewModel, type ViewModel } from "../../../../core/viewmodel";
import { _t } from "../../../../core/i18n/i18n";

/**
 * Opaque type representing a Room object from the parent application
 */
export type Room = unknown;

/**
 * Generate an accessible label for a room based on its notification state.
 */
function getA11yLabel(roomName: string, notification: NotificationDecorationData): string {
    if (notification.isUnsentMessage) {
        return _t("room_list|a11y|unsent_message", { roomName });
    } else if (notification.invited) {
        return _t("room_list|a11y|invitation", { roomName });
    } else if (notification.isMention && notification.count) {
        return _t("room_list|a11y|mention", { roomName, count: notification.count });
    } else if (notification.hasUnreadCount && notification.count) {
        return _t("room_list|a11y|unread", { roomName, count: notification.count });
    } else if (notification.callType === "voice") {
        return _t("room_list|a11y|voice_call", { roomName });
    } else if (notification.callType === "video") {
        return _t("room_list|a11y|video_call", { roomName });
    } else {
        return _t("room_list|a11y|default", { roomName });
    }
}

/**
 * Snapshot for a room list item.
 * Contains all the data needed to render a room in the list.
 */
export interface RoomListItemViewSnapshot {
    /** Unique identifier for the room (used for list keying) */
    id: string;
    /** The opaque Room object from the client (e.g., matrix-js-sdk Room) */
    room: Room;
    /** The name of the room */
    name: string;
    /** Whether the room name should be bolded (has unread/activity) */
    isBold: boolean;
    /** Optional message preview text */
    messagePreview?: string;
    /** Notification decoration data */
    notification: NotificationDecorationData;
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
    /** The room's notification state */
    roomNotifState: RoomNotifState;
}

/**
 * Actions interface for room list item operations.
 * Implemented by the room item view model.
 */
export interface RoomListItemViewActions {
    /** Called when the room should be opened */
    onOpenRoom: () => void;
    /** Called when the room should be marked as read */
    onMarkAsRead: () => void;
    /** Called when the room should be marked as unread */
    onMarkAsUnread: () => void;
    /** Called when the room's favorite status should be toggled */
    onToggleFavorite: () => void;
    /** Called when the room's low priority status should be toggled */
    onToggleLowPriority: () => void;
    /** Called when inviting users to the room */
    onInvite: () => void;
    /** Called when copying the room link */
    onCopyRoomLink: () => void;
    /** Called when leaving the room */
    onLeaveRoom: () => void;
    /** Called when setting the room notification state */
    onSetRoomNotifState: (state: RoomNotifState) => void;
}

/**
 * The view model type for a room list item
 */
export type RoomListItemViewModel = ViewModel<RoomListItemViewSnapshot, RoomListItemViewActions>;

/**
 * Props for RoomListItemView component
 */
export interface RoomListItemViewProps extends Omit<React.HTMLAttributes<HTMLButtonElement>, "onFocus"> {
    /** The room item view model */
    vm: RoomListItemViewModel;
    /** Whether the room is selected */
    isSelected: boolean;
    /** Whether the room should be focused */
    isFocused: boolean;
    /** Callback when item receives focus */
    onFocus: (roomId: string, e: React.FocusEvent) => void;
    /** Whether this is the first item in the list */
    isFirstItem: boolean;
    /** Whether this is the last item in the list */
    isLastItem: boolean;
    /** Function to render the room avatar */
    renderAvatar: (room: Room) => ReactNode;
}

/**
 * A presentational room list item component.
 * Displays room name, avatar, message preview, and notifications.
 */
export const RoomListItemView = memo(function RoomListItemView({
    vm,
    isSelected,
    isFocused,
    onFocus,
    isFirstItem,
    isLastItem,
    renderAvatar,
    ...props
}: RoomListItemViewProps): JSX.Element {
    const ref = useRef<HTMLButtonElement>(null);
    const item = useViewModel(vm);

    useEffect(() => {
        if (isFocused) {
            ref.current?.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
        }
    }, [isFocused]);

    // Generate a11y label from notification state and room name
    const a11yLabel = getA11yLabel(item.name, item.notification);

    return (
        <RoomListItemContextMenu vm={vm}>
            <Flex
                as="button"
                ref={ref}
                className={classNames(styles.roomListItem, "mx_RoomListItemView", {
                    [styles.selected]: isSelected,
                    [styles.bold]: item.isBold,
                    [styles.firstItem]: isFirstItem,
                    [styles.lastItem]: isLastItem,
                    mx_RoomListItemView_selected: isSelected,
                })}
                gap="var(--cpd-space-3x)"
                align="stretch"
                type="button"
                aria-selected={isSelected}
                aria-label={a11yLabel}
                onClick={vm.onOpenRoom}
                onFocus={(e: React.FocusEvent<HTMLButtonElement>) => onFocus(item.id, e)}
                tabIndex={isFocused ? 0 : -1}
                {...props}
            >
                <Flex className={styles.container} gap="var(--cpd-space-3x)" align="center">
                    {renderAvatar(item.room)}
                    <Flex className={styles.content} gap="var(--cpd-space-2x)" align="center" justify="space-between">
                        {/* We truncate the room name when too long. Title here is to show the full name on hover */}
                        <div className={styles.ellipsis}>
                            <div className={styles.roomName} title={item.name} data-testid="room-name">
                                {item.name}
                            </div>
                            {item.messagePreview && (
                                <Text as="div" size="sm" className={styles.ellipsis} title={item.messagePreview}>
                                    {item.messagePreview}
                                </Text>
                            )}
                        </div>
                        {(item.showMoreOptionsMenu || item.showNotificationMenu) && (
                            <RoomListItemHoverMenu
                                showMoreOptionsMenu={item.showMoreOptionsMenu}
                                showNotificationMenu={item.showNotificationMenu}
                                vm={vm}
                            />
                        )}

                        {/* aria-hidden because we summarise the unread count/notification status in a11yLabel */}
                        <div className={styles.notificationDecoration} aria-hidden={true}>
                            <NotificationDecoration {...item.notification} />
                        </div>
                    </Flex>
                </Flex>
            </Flex>
        </RoomListItemContextMenu>
    );
});

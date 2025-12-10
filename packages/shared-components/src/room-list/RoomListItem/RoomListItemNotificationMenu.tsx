/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useState, useCallback, type JSX, type ComponentProps } from "react";
import { IconButton, Menu, MenuItem, Tooltip } from "@vector-im/compound-web";
import NotificationIcon from "@vector-im/compound-design-tokens/assets/web/icons/notifications-solid";
import NotificationOffIcon from "@vector-im/compound-design-tokens/assets/web/icons/notifications-off-solid";
import CheckIcon from "@vector-im/compound-design-tokens/assets/web/icons/check";

import { _t } from "../../utils/i18n";
import { RoomNotifState } from "../../notifications/RoomNotifs";

/**
 * State for the notification menu
 */
export interface NotificationMenuState {
    /** Whether the notification is set to all messages */
    isNotificationAllMessage: boolean;
    /** Whether the notification is set to all messages loud */
    isNotificationAllMessageLoud: boolean;
    /** Whether the notification is set to mentions and keywords only */
    isNotificationMentionOnly: boolean;
    /** Whether the notification is muted */
    isNotificationMute: boolean;
}

/**
 * Props for RoomListItemNotificationMenu component
 */
export interface RoomListItemNotificationMenuProps {
    /** Notification menu state */
    state: NotificationMenuState;
    /** Set the room notification state */
    onSetRoomNotifState: (state: RoomNotifState) => void;
    /** Callback when menu open state changes */
    onMenuOpenChange: (isOpen: boolean) => void;
}

/**
 * The notification settings menu for room list items.
 * Displays options to change notification settings.
 */
export function RoomListItemNotificationMenu({
    state,
    onSetRoomNotifState,
    onMenuOpenChange,
}: RoomListItemNotificationMenuProps): JSX.Element {
    const [open, setOpen] = useState(false);

    const handleOpenChange = useCallback(
        (isOpen: boolean) => {
            setOpen(isOpen);
            onMenuOpenChange(isOpen);
        },
        [onMenuOpenChange],
    );

    const checkComponent = <CheckIcon width="24px" height="24px" color="var(--cpd-color-icon-primary)" />;

    return (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div onKeyDown={(e) => e.stopPropagation()}>
            <Menu
                open={open}
                onOpenChange={handleOpenChange}
                title={_t("room_list|notification_options")}
                showTitle={false}
                align="start"
                trigger={<NotificationButton isRoomMuted={state.isNotificationMute} size="24px" />}
            >
                <MenuItem
                    aria-selected={state.isNotificationAllMessage}
                    hideChevron={true}
                    label={_t("notifications|default_settings")}
                    onSelect={() => onSetRoomNotifState(RoomNotifState.AllMessages)}
                    onClick={(evt) => evt.stopPropagation()}
                >
                    {state.isNotificationAllMessage && checkComponent}
                </MenuItem>
                <MenuItem
                    aria-selected={state.isNotificationAllMessageLoud}
                    hideChevron={true}
                    label={_t("notifications|all_messages")}
                    onSelect={() => onSetRoomNotifState(RoomNotifState.AllMessagesLoud)}
                    onClick={(evt) => evt.stopPropagation()}
                >
                    {state.isNotificationAllMessageLoud && checkComponent}
                </MenuItem>
                <MenuItem
                    aria-selected={state.isNotificationMentionOnly}
                    hideChevron={true}
                    label={_t("notifications|mentions_keywords")}
                    onSelect={() => onSetRoomNotifState(RoomNotifState.MentionsOnly)}
                    onClick={(evt) => evt.stopPropagation()}
                >
                    {state.isNotificationMentionOnly && checkComponent}
                </MenuItem>
                <MenuItem
                    aria-selected={state.isNotificationMute}
                    hideChevron={true}
                    label={_t("notifications|mute_room")}
                    onSelect={() => onSetRoomNotifState(RoomNotifState.Mute)}
                    onClick={(evt) => evt.stopPropagation()}
                >
                    {state.isNotificationMute && checkComponent}
                </MenuItem>
            </Menu>
        </div>
    );
}

interface NotificationButtonProps extends ComponentProps<typeof IconButton> {
    isRoomMuted: boolean;
}

const NotificationButton = function NotificationButton({
    isRoomMuted,
    ...props
}: NotificationButtonProps): JSX.Element {
    return (
        <Tooltip label={_t("room_list|notification_options")}>
            <IconButton aria-label={_t("room_list|notification_options")} {...props}>
                {isRoomMuted ? <NotificationOffIcon /> : <NotificationIcon />}
            </IconButton>
        </Tooltip>
    );
};

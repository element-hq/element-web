/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentProps, forwardRef, type JSX, useState } from "react";
import { IconButton, Menu, MenuItem, Separator, ToggleMenuItem, Tooltip } from "@vector-im/compound-web";
import MarkAsReadIcon from "@vector-im/compound-design-tokens/assets/web/icons/mark-as-read";
import MarkAsUnreadIcon from "@vector-im/compound-design-tokens/assets/web/icons/mark-as-unread";
import FavouriteIcon from "@vector-im/compound-design-tokens/assets/web/icons/favourite";
import ArrowDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/arrow-down";
import UserAddIcon from "@vector-im/compound-design-tokens/assets/web/icons/user-add";
import LinkIcon from "@vector-im/compound-design-tokens/assets/web/icons/link";
import LeaveIcon from "@vector-im/compound-design-tokens/assets/web/icons/leave";
import OverflowIcon from "@vector-im/compound-design-tokens/assets/web/icons/overflow-horizontal";
import NotificationIcon from "@vector-im/compound-design-tokens/assets/web/icons/notifications-solid";
import NotificationOffIcon from "@vector-im/compound-design-tokens/assets/web/icons/notifications-off-solid";
import CheckIcon from "@vector-im/compound-design-tokens/assets/web/icons/check";
import { type Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../languageHandler";
import { Flex } from "../../../utils/Flex";
import {
    type RoomListItemMenuViewState,
    useRoomListItemMenuViewModel,
} from "../../../viewmodels/roomlist/RoomListItemMenuViewModel";
import { RoomNotifState } from "../../../../RoomNotifs";

interface RoomListItemMenuViewProps {
    /**
     * The room to display the menu for.
     */
    room: Room;
    /**
     * Set the menu open state.
     * @param isOpen
     */
    setMenuOpen: (isOpen: boolean) => void;
}

/**
 * A view for the room list item menu.
 */
export function RoomListItemMenuView({ room, setMenuOpen }: RoomListItemMenuViewProps): JSX.Element {
    const vm = useRoomListItemMenuViewModel(room);

    return (
        <Flex className="mx_RoomListItemMenuView" align="center" gap="var(--cpd-space-0-5x)">
            {vm.showMoreOptionsMenu && <MoreOptionsMenu setMenuOpen={setMenuOpen} vm={vm} />}
            {vm.showNotificationMenu && <NotificationMenu setMenuOpen={setMenuOpen} vm={vm} />}
        </Flex>
    );
}

interface MoreOptionsMenuProps {
    /**
     * The view model state for the menu.
     */
    vm: RoomListItemMenuViewState;
    /**
     * Set the menu open state.
     * @param isOpen
     */
    setMenuOpen: (isOpen: boolean) => void;
}

/**
 * The more options menu for the room list item.
 */
function MoreOptionsMenu({ vm, setMenuOpen }: MoreOptionsMenuProps): JSX.Element {
    const [open, setOpen] = useState(false);

    return (
        <Menu
            open={open}
            onOpenChange={(isOpen) => {
                setOpen(isOpen);
                setMenuOpen(isOpen);
            }}
            title={_t("room_list|room|more_options")}
            showTitle={false}
            align="start"
            trigger={<MoreOptionsButton size="24px" />}
        >
            {vm.canMarkAsRead && (
                <MenuItem
                    Icon={MarkAsReadIcon}
                    label={_t("room_list|more_options|mark_read")}
                    onSelect={vm.markAsRead}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            {vm.canMarkAsUnread && (
                <MenuItem
                    Icon={MarkAsUnreadIcon}
                    label={_t("room_list|more_options|mark_unread")}
                    onSelect={vm.markAsUnread}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            <ToggleMenuItem
                checked={vm.isFavourite}
                Icon={FavouriteIcon}
                label={_t("room_list|more_options|favourited")}
                onSelect={vm.toggleFavorite}
                onClick={(evt) => evt.stopPropagation()}
            />
            <MenuItem
                Icon={ArrowDownIcon}
                label={_t("room_list|more_options|low_priority")}
                onSelect={vm.toggleLowPriority}
                onClick={(evt) => evt.stopPropagation()}
                hideChevron={true}
            />
            {vm.canInvite && (
                <MenuItem
                    Icon={UserAddIcon}
                    label={_t("action|invite")}
                    onSelect={vm.invite}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            {vm.canCopyRoomLink && (
                <MenuItem
                    Icon={LinkIcon}
                    label={_t("room_list|more_options|copy_link")}
                    onSelect={vm.copyRoomLink}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            <Separator />
            <MenuItem
                kind="critical"
                Icon={LeaveIcon}
                label={_t("room_list|more_options|leave_room")}
                onSelect={vm.leaveRoom}
                onClick={(evt) => evt.stopPropagation()}
                hideChevron={true}
            />
        </Menu>
    );
}

interface MoreOptionsButtonProps extends ComponentProps<typeof IconButton> {}

/**
 * A button to trigger the more options menu.
 */
export const MoreOptionsButton = forwardRef<HTMLButtonElement, MoreOptionsButtonProps>(
    function MoreOptionsButton(props, ref) {
        return (
            <Tooltip label={_t("room_list|room|more_options")}>
                <IconButton aria-label={_t("room_list|room|more_options")} {...props} ref={ref}>
                    <OverflowIcon />
                </IconButton>
            </Tooltip>
        );
    },
);

interface NotificationMenuProps {
    /**
     * The view model state for the menu.
     */
    vm: RoomListItemMenuViewState;
    /**
     * Set the menu open state.
     * @param isOpen
     */
    setMenuOpen: (isOpen: boolean) => void;
}

function NotificationMenu({ vm, setMenuOpen }: NotificationMenuProps): JSX.Element {
    const [open, setOpen] = useState(false);

    const checkComponent = <CheckIcon width="24px" height="24px" color="var(--cpd-color-icon-primary)" />;

    return (
        <Menu
            open={open}
            onOpenChange={(isOpen) => {
                setOpen(isOpen);
                setMenuOpen(isOpen);
            }}
            title={_t("room_list|notification_options")}
            showTitle={false}
            align="start"
            trigger={<NotificationButton isRoomMuted={vm.isNotificationMute} size="24px" />}
        >
            <MenuItem
                aria-selected={vm.isNotificationAllMessage}
                hideChevron={true}
                label={_t("notifications|default_settings")}
                onSelect={() => vm.setRoomNotifState(RoomNotifState.AllMessages)}
                onClick={(evt) => evt.stopPropagation()}
            >
                {vm.isNotificationAllMessage && checkComponent}
            </MenuItem>
            <MenuItem
                aria-selected={vm.isNotificationAllMessageLoud}
                hideChevron={true}
                label={_t("notifications|all_messages")}
                onSelect={() => vm.setRoomNotifState(RoomNotifState.AllMessagesLoud)}
                onClick={(evt) => evt.stopPropagation()}
            >
                {vm.isNotificationAllMessageLoud && checkComponent}
            </MenuItem>
            <MenuItem
                aria-selected={vm.isNotificationMentionOnly}
                hideChevron={true}
                label={_t("notifications|mentions_keywords")}
                onSelect={() => vm.setRoomNotifState(RoomNotifState.MentionsOnly)}
                onClick={(evt) => evt.stopPropagation()}
            >
                {vm.isNotificationMentionOnly && checkComponent}
            </MenuItem>
            <MenuItem
                aria-selected={vm.isNotificationMute}
                hideChevron={true}
                label={_t("notifications|mute_room")}
                onSelect={() => vm.setRoomNotifState(RoomNotifState.Mute)}
                onClick={(evt) => evt.stopPropagation()}
            >
                {vm.isNotificationMute && checkComponent}
            </MenuItem>
        </Menu>
    );
}

interface NotificationButtonProps extends ComponentProps<typeof IconButton> {
    /**
     * Whether the room is muted.
     */
    isRoomMuted: boolean;
}

/**
 * A button to trigger the notification menu.
 */
export const NotificationButton = forwardRef<HTMLButtonElement, NotificationButtonProps>(function MoreOptionsButton(
    { isRoomMuted, ...props },
    ref,
) {
    return (
        <Tooltip label={_t("room_list|notification_options")}>
            <IconButton aria-label={_t("room_list|notification_options")} {...props} ref={ref}>
                {isRoomMuted ? <NotificationOffIcon /> : <NotificationIcon />}
            </IconButton>
        </Tooltip>
    );
});

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useState } from "react";
import { IconButton, Menu, MenuItem, Separator, ToggleMenuItem } from "@vector-im/compound-web";
import {
    MarkAsReadIcon,
    MarkAsUnreadIcon,
    FavouriteIcon,
    ArrowDownIcon,
    UserAddIcon,
    LinkIcon,
    LeaveIcon,
    OverflowHorizontalIcon,
    NotificationsSolidIcon,
    NotificationsOffSolidIcon,
    CheckIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { type Room } from "matrix-js-sdk/src/matrix";
import { Flex } from "@element-hq/web-shared-components";
import classNames from "classnames";

import { _t } from "../../../../languageHandler";
import {
    type RoomListItemMenuViewState,
    useRoomListItemMenuViewModel,
} from "../../../viewmodels/roomlist/RoomListItemMenuViewModel";
import { RoomNotifState } from "../../../../RoomNotifs";

interface RoomListItemMenuViewProps {
    /**
     * Additional class name for the root element.
     */
    className?: string;

    /**
     * The room to display the menu for.
     */
    room: Room;
}

/**
 * A view for the room list item menu.
 */
export function RoomListItemMenuView({ room, className }: RoomListItemMenuViewProps): JSX.Element {
    const vm = useRoomListItemMenuViewModel(room);

    return (
        <Flex className={classNames("mx_RoomListItemMenuView", className)} align="center" gap="var(--cpd-space-1x)">
            {vm.showMoreOptionsMenu && <MoreOptionsMenu vm={vm} />}
            {vm.showNotificationMenu && <NotificationMenu vm={vm} />}
        </Flex>
    );
}

interface MoreOptionsMenuProps {
    /**
     * The view model state for the menu.
     */
    vm: RoomListItemMenuViewState;
}

/**
 * The more options menu for the room list item.
 */
function MoreOptionsMenu({ vm }: MoreOptionsMenuProps): JSX.Element {
    const [open, setOpen] = useState(false);

    return (
        <Menu
            open={open}
            onOpenChange={setOpen}
            title={_t("room_list|room|more_options")}
            showTitle={false}
            align="start"
            trigger={
                <IconButton
                    tooltip={_t("room_list|room|more_options")}
                    aria-label={_t("room_list|room|more_options")}
                    size="24px"
                >
                    <OverflowHorizontalIcon />
                </IconButton>
            }
        >
            <MoreOptionContent vm={vm} />
        </Menu>
    );
}

interface MoreOptionContentProps {
    /**
     * The view model state for the menu.
     */
    vm: RoomListItemMenuViewState;
}

export function MoreOptionContent({ vm }: MoreOptionContentProps): JSX.Element {
    return (
        <div
            // We don't want keyboard navigation events to bubble up to the ListView changing the focused item
            onKeyDown={(e) => e.stopPropagation()}
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
            <ToggleMenuItem
                checked={vm.isLowPriority}
                Icon={ArrowDownIcon}
                label={_t("room_list|more_options|low_priority")}
                onSelect={vm.toggleLowPriority}
                onClick={(evt) => evt.stopPropagation()}
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
        </div>
    );
}

interface NotificationMenuProps {
    /**
     * The view model state for the menu.
     */
    vm: RoomListItemMenuViewState;
}

function NotificationMenu({ vm }: NotificationMenuProps): JSX.Element {
    const [open, setOpen] = useState(false);
    const checkComponent = <CheckIcon width="24px" height="24px" color="var(--cpd-color-icon-primary)" />;

    return (
        <Menu
            open={open}
            onOpenChange={setOpen}
            title={_t("room_list|notification_options")}
            showTitle={false}
            align="start"
            trigger={
                <IconButton
                    size="24px"
                    tooltip={_t("room_list|notification_options")}
                    aria-label={_t("room_list|notification_options")}
                >
                    {vm.isNotificationMute ? <NotificationsOffSolidIcon /> : <NotificationsSolidIcon />}
                </IconButton>
            }
        >
            <div
                // We don't want keyboard navigation events to bubble up to the ListView changing the focused item
                onKeyDown={(e) => e.stopPropagation()}
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
            </div>
        </Menu>
    );
}

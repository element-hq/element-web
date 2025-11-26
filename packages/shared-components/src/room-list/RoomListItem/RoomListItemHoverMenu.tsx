/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useState, useCallback, type JSX, type ComponentProps } from "react";
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

import { Flex } from "../../utils/Flex";
import { _t } from "../../utils/i18n";
import { RoomNotifState } from "../../notifications/RoomNotifs";
import { type RoomListItemMenuViewModel } from "./RoomListItemMenuViewModel";

/**
 * Props for RoomListItemHoverMenu component
 */
export interface RoomListItemHoverMenuProps {
    /** The view model containing menu data and callbacks */
    viewModel: RoomListItemMenuViewModel;
    /** Callback when menu open state changes */
    onMenuOpenChange: (isOpen: boolean) => void;
}

/**
 * The hover menu for room list items.
 * Displays more options and notification settings menus.
 */
export const RoomListItemHoverMenu: React.FC<RoomListItemHoverMenuProps> = ({
    viewModel,
    onMenuOpenChange,
}): JSX.Element => {
    return (
        <Flex className="mx_RoomListItemHoverMenu" align="center" gap="var(--cpd-space-1x)">
            {viewModel.showMoreOptionsMenu && (
                <MoreOptionsMenu viewModel={viewModel} onMenuOpenChange={onMenuOpenChange} />
            )}
            {viewModel.showNotificationMenu && (
                <NotificationMenu viewModel={viewModel} onMenuOpenChange={onMenuOpenChange} />
            )}
        </Flex>
    );
};

interface MoreOptionsMenuProps {
    viewModel: RoomListItemMenuViewModel;
    onMenuOpenChange: (isOpen: boolean) => void;
}

function MoreOptionsMenu({ viewModel, onMenuOpenChange }: MoreOptionsMenuProps): JSX.Element {
    const [open, setOpen] = useState(false);

    const handleOpenChange = useCallback(
        (isOpen: boolean) => {
            setOpen(isOpen);
            onMenuOpenChange(isOpen);
        },
        [onMenuOpenChange],
    );

    return (
        <Menu
            open={open}
            onOpenChange={handleOpenChange}
            title={_t("room_list|room|more_options")}
            showTitle={false}
            align="start"
            trigger={<MoreOptionsButton size="24px" />}
        >
            <MoreOptionContent viewModel={viewModel} />
        </Menu>
    );
}

interface MoreOptionContentProps {
    viewModel: RoomListItemMenuViewModel;
}

export function MoreOptionContent({ viewModel }: MoreOptionContentProps): JSX.Element {
    return (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div onKeyDown={(e) => e.stopPropagation()}>
            {viewModel.canMarkAsRead && (
                <MenuItem
                    Icon={MarkAsReadIcon}
                    label={_t("room_list|more_options|mark_read")}
                    onSelect={viewModel.markAsRead}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            {viewModel.canMarkAsUnread && (
                <MenuItem
                    Icon={MarkAsUnreadIcon}
                    label={_t("room_list|more_options|mark_unread")}
                    onSelect={viewModel.markAsUnread}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            <ToggleMenuItem
                checked={viewModel.isFavourite}
                Icon={FavouriteIcon}
                label={_t("room_list|more_options|favourited")}
                onSelect={viewModel.toggleFavorite}
                onClick={(evt) => evt.stopPropagation()}
            />
            <ToggleMenuItem
                checked={viewModel.isLowPriority}
                Icon={ArrowDownIcon}
                label={_t("room_list|more_options|low_priority")}
                onSelect={viewModel.toggleLowPriority}
                onClick={(evt) => evt.stopPropagation()}
            />
            {viewModel.canInvite && (
                <MenuItem
                    Icon={UserAddIcon}
                    label={_t("action|invite")}
                    onSelect={viewModel.invite}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            {viewModel.canCopyRoomLink && (
                <MenuItem
                    Icon={LinkIcon}
                    label={_t("room_list|more_options|copy_link")}
                    onSelect={viewModel.copyRoomLink}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            <Separator />
            <MenuItem
                kind="critical"
                Icon={LeaveIcon}
                label={_t("room_list|more_options|leave_room")}
                onSelect={viewModel.leaveRoom}
                onClick={(evt) => evt.stopPropagation()}
                hideChevron={true}
            />
        </div>
    );
}

const MoreOptionsButton = function MoreOptionsButton(props: ComponentProps<typeof IconButton>): JSX.Element {
    return (
        <Tooltip label={_t("room_list|room|more_options")}>
            <IconButton aria-label={_t("room_list|room|more_options")} {...props}>
                <OverflowIcon />
            </IconButton>
        </Tooltip>
    );
};

interface NotificationMenuProps {
    viewModel: RoomListItemMenuViewModel;
    onMenuOpenChange: (isOpen: boolean) => void;
}

function NotificationMenu({ viewModel, onMenuOpenChange }: NotificationMenuProps): JSX.Element {
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
                trigger={<NotificationButton isRoomMuted={viewModel.isNotificationMute} size="24px" />}
            >
                <MenuItem
                    aria-selected={viewModel.isNotificationAllMessage}
                    hideChevron={true}
                    label={_t("notifications|default_settings")}
                    onSelect={() => viewModel.setRoomNotifState(RoomNotifState.AllMessages)}
                    onClick={(evt) => evt.stopPropagation()}
                >
                    {viewModel.isNotificationAllMessage && checkComponent}
                </MenuItem>
                <MenuItem
                    aria-selected={viewModel.isNotificationAllMessageLoud}
                    hideChevron={true}
                    label={_t("notifications|all_messages")}
                    onSelect={() => viewModel.setRoomNotifState(RoomNotifState.AllMessagesLoud)}
                    onClick={(evt) => evt.stopPropagation()}
                >
                    {viewModel.isNotificationAllMessageLoud && checkComponent}
                </MenuItem>
                <MenuItem
                    aria-selected={viewModel.isNotificationMentionOnly}
                    hideChevron={true}
                    label={_t("notifications|mentions_keywords")}
                    onSelect={() => viewModel.setRoomNotifState(RoomNotifState.MentionsOnly)}
                    onClick={(evt) => evt.stopPropagation()}
                >
                    {viewModel.isNotificationMentionOnly && checkComponent}
                </MenuItem>
                <MenuItem
                    aria-selected={viewModel.isNotificationMute}
                    hideChevron={true}
                    label={_t("notifications|mute_room")}
                    onSelect={() => viewModel.setRoomNotifState(RoomNotifState.Mute)}
                    onClick={(evt) => evt.stopPropagation()}
                >
                    {viewModel.isNotificationMute && checkComponent}
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

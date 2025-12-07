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

import { _t } from "../../utils/i18n";

/**
 * State for the more options menu
 */
export interface MoreOptionsMenuState {
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
}

/**
 * Callbacks for the more options menu
 */
export interface MoreOptionsMenuCallbacks {
    /** Mark the room as read */
    onMarkAsRead: () => void;
    /** Mark the room as unread */
    onMarkAsUnread: () => void;
    /** Toggle the room as favourite */
    onToggleFavorite: () => void;
    /** Toggle the room as low priority */
    onToggleLowPriority: () => void;
    /** Invite other users in the room */
    onInvite: () => void;
    /** Copy the room link to clipboard */
    onCopyRoomLink: () => void;
    /** Leave the room */
    onLeaveRoom: () => void;
}

/**
 * Props for RoomListItemMoreOptionsMenu component
 */
export interface RoomListItemMoreOptionsMenuProps {
    /** More options menu state */
    state: MoreOptionsMenuState;
    /** More options menu callbacks */
    callbacks: MoreOptionsMenuCallbacks;
    /** Callback when menu open state changes */
    onMenuOpenChange: (isOpen: boolean) => void;
}

/**
 * The more options menu for room list items.
 * Displays additional room actions like mark as read/unread, favorite, invite, etc.
 */
export function RoomListItemMoreOptionsMenu({
    state,
    callbacks,
    onMenuOpenChange,
}: RoomListItemMoreOptionsMenuProps): JSX.Element {
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
            <MoreOptionContent state={state} callbacks={callbacks} />
        </Menu>
    );
}

interface MoreOptionContentProps {
    state: MoreOptionsMenuState;
    callbacks: MoreOptionsMenuCallbacks;
}

export function MoreOptionContent({ state, callbacks }: MoreOptionContentProps): JSX.Element {
    return (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div onKeyDown={(e) => e.stopPropagation()}>
            {state.canMarkAsRead && (
                <MenuItem
                    Icon={MarkAsReadIcon}
                    label={_t("room_list|more_options|mark_read")}
                    onSelect={callbacks.onMarkAsRead}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            {state.canMarkAsUnread && (
                <MenuItem
                    Icon={MarkAsUnreadIcon}
                    label={_t("room_list|more_options|mark_unread")}
                    onSelect={callbacks.onMarkAsUnread}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            <ToggleMenuItem
                checked={state.isFavourite}
                Icon={FavouriteIcon}
                label={_t("room_list|more_options|favourited")}
                onSelect={callbacks.onToggleFavorite}
                onClick={(evt) => evt.stopPropagation()}
            />
            <ToggleMenuItem
                checked={state.isLowPriority}
                Icon={ArrowDownIcon}
                label={_t("room_list|more_options|low_priority")}
                onSelect={callbacks.onToggleLowPriority}
                onClick={(evt) => evt.stopPropagation()}
            />
            {state.canInvite && (
                <MenuItem
                    Icon={UserAddIcon}
                    label={_t("action|invite")}
                    onSelect={callbacks.onInvite}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            {state.canCopyRoomLink && (
                <MenuItem
                    Icon={LinkIcon}
                    label={_t("room_list|more_options|copy_link")}
                    onSelect={callbacks.onCopyRoomLink}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            <Separator />
            <MenuItem
                kind="critical"
                Icon={LeaveIcon}
                label={_t("room_list|more_options|leave_room")}
                onSelect={callbacks.onLeaveRoom}
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

/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useState, type JSX } from "react";
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
} from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../utils/i18n";
import { useViewModel, type ViewModel } from "../../viewmodel";
import type { RoomListItemSnapshot, RoomListItemActions } from "./RoomListItemView";

/**
 * View model type for room list item
 */
export type RoomItemViewModel = ViewModel<RoomListItemSnapshot> & RoomListItemActions;

/**
 * Props for RoomListItemMoreOptionsMenu component
 */
export interface RoomListItemMoreOptionsMenuProps {
    /** The room item view model */
    vm: RoomItemViewModel;
}

/**
 * The more options menu for room list items.
 * Displays additional room actions like mark as read/unread, favorite, invite, etc.
 */
export function RoomListItemMoreOptionsMenu({ vm }: RoomListItemMoreOptionsMenuProps): JSX.Element {
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
                    style={{ padding: "2px" }}
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
    vm: RoomItemViewModel;
}

export function MoreOptionContent({ vm }: MoreOptionContentProps): JSX.Element {
    const snapshot = useViewModel(vm);
    return (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div onKeyDown={(e) => e.stopPropagation()}>
            {snapshot.canMarkAsRead && (
                <MenuItem
                    Icon={MarkAsReadIcon}
                    label={_t("room_list|more_options|mark_read")}
                    onSelect={vm.onMarkAsRead}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            {snapshot.canMarkAsUnread && (
                <MenuItem
                    Icon={MarkAsUnreadIcon}
                    label={_t("room_list|more_options|mark_unread")}
                    onSelect={vm.onMarkAsUnread}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            <ToggleMenuItem
                checked={snapshot.isFavourite}
                Icon={FavouriteIcon}
                label={_t("room_list|more_options|favourited")}
                onSelect={vm.onToggleFavorite}
                onClick={(evt) => evt.stopPropagation()}
            />
            <ToggleMenuItem
                checked={snapshot.isLowPriority}
                Icon={ArrowDownIcon}
                label={_t("room_list|more_options|low_priority")}
                onSelect={vm.onToggleLowPriority}
                onClick={(evt) => evt.stopPropagation()}
            />
            {snapshot.canInvite && (
                <MenuItem
                    Icon={UserAddIcon}
                    label={_t("action|invite")}
                    onSelect={vm.onInvite}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            {snapshot.canCopyRoomLink && (
                <MenuItem
                    Icon={LinkIcon}
                    label={_t("room_list|more_options|copy_link")}
                    onSelect={vm.onCopyRoomLink}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            <Separator />
            <MenuItem
                kind="critical"
                Icon={LeaveIcon}
                label={_t("room_list|more_options|leave_room")}
                onSelect={vm.onLeaveRoom}
                onClick={(evt) => evt.stopPropagation()}
                hideChevron={true}
            />
        </div>
    );
}

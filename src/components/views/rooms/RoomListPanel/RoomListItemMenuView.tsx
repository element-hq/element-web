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
import { type Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../languageHandler";
import { Flex } from "../../../utils/Flex";
import {
    type RoomListItemMenuViewState,
    useRoomListItemMenuViewModel,
} from "../../../viewmodels/roomlist/RoomListItemMenuViewModel";

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
                />
            )}
            {vm.canMarkAsUnread && (
                <MenuItem
                    Icon={MarkAsUnreadIcon}
                    label={_t("room_list|more_options|mark_unread")}
                    onSelect={vm.markAsUnread}
                    onClick={(evt) => evt.stopPropagation()}
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
            />
            {vm.canInvite && (
                <MenuItem
                    Icon={UserAddIcon}
                    label={_t("action|invite")}
                    onSelect={vm.invite}
                    onClick={(evt) => evt.stopPropagation()}
                />
            )}
            {vm.canCopyRoomLink && (
                <MenuItem
                    Icon={LinkIcon}
                    label={_t("room_list|more_options|copy_link")}
                    onSelect={vm.copyRoomLink}
                    onClick={(evt) => evt.stopPropagation()}
                />
            )}
            <Separator />
            <MenuItem
                kind="critical"
                Icon={LeaveIcon}
                label={_t("room_list|more_options|leave_room")}
                onSelect={vm.leaveRoom}
                onClick={(evt) => evt.stopPropagation()}
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

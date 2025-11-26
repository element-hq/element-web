/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, memo, useCallback, type ReactNode } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import { RoomListItem as SharedRoomListItem } from "@element-hq/web-shared-components";

import { useRoomListItemViewModel } from "../../../viewmodels/roomlist/RoomListItemViewModel";
import { RoomListItemMenuView } from "./RoomListItemMenuView";
import { NotificationDecoration } from "../NotificationDecoration";
import { RoomAvatarView } from "../../avatars/RoomAvatarView";
import { RoomListItemContextMenuView } from "./RoomListItemContextMenuView";

interface RoomListItemViewProps extends Omit<React.HTMLAttributes<HTMLButtonElement>, "onFocus"> {
    /**
     * The room to display
     */
    room: Room;
    /**
     * Whether the room is selected
     */
    isSelected: boolean;
    /**
     * Whether the room is focused
     */
    isFocused: boolean;
    /**
     * A callback that indicates the item has received focus
     */
    onFocus: (room: Room, e: React.FocusEvent) => void;
    /**
     * The index of the room in the list
     */
    roomIndex: number;
    /**
     * The total number of rooms in the list
     */
    roomCount: number;
}

/**
 * An item in the room list.
 * This component wraps the shared RoomListItem and provides element-web specific
 * implementations for the avatar, notifications, and menus.
 */
export const RoomListItemView = memo(function RoomListItemView({
    room,
    isSelected,
    isFocused,
    onFocus,
    roomIndex,
    roomCount,
    ...props
}: RoomListItemViewProps): JSX.Element {
    const vm = useRoomListItemViewModel(room);

    // Wrap onFocus to include the room parameter
    const handleFocus = useCallback(
        (e: React.FocusEvent) => {
            onFocus(room, e);
        },
        [onFocus, room],
    );

    // Create the avatar component
    const avatar = <RoomAvatarView room={room} />;

    // Create the notification decoration component
    const notificationDecoration = vm.showNotificationDecoration ? (
        <NotificationDecoration
            notificationState={vm.notificationState}
            aria-hidden={true}
            callType={vm.callType}
        />
    ) : null;

    // Create the hover menu component
    const hoverMenu = vm.showHoverMenu ? <RoomListItemMenuView room={room} setMenuOpen={() => {}} /> : null;

    // Create the context menu wrapper function
    const contextMenuWrapper = vm.showContextMenu
        ? (content: ReactNode) => (
              <RoomListItemContextMenuView room={room} setMenuOpen={() => {}}>
                  {content}
              </RoomListItemContextMenuView>
          )
        : undefined;

    return (
        <SharedRoomListItem
            viewModel={vm}
            isSelected={isSelected}
            isFocused={isFocused}
            onFocus={handleFocus}
            roomIndex={roomIndex}
            roomCount={roomCount}
            avatar={avatar}
            notificationDecoration={notificationDecoration}
            hoverMenu={hoverMenu}
            contextMenuWrapper={contextMenuWrapper}
            {...props}
        />
    );
});

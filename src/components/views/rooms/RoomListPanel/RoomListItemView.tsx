/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, memo, useEffect, useRef } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";
import { Flex } from "@element-hq/web-shared-components";

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
 * An item in the room list
 */
export const RoomListItemView = memo(function RoomListItemView({
    room,
    isSelected,
    isFocused,
    onFocus,
    roomIndex: index,
    roomCount: count,
    ...props
}: RoomListItemViewProps): JSX.Element {
    const ref = useRef<HTMLButtonElement>(null);
    const vm = useRoomListItemViewModel(room);

    useEffect(() => {
        if (isFocused) {
            ref.current?.focus({ preventScroll: true, focusVisible: true });
        }
    }, [isFocused]);

    const content = (
        <Flex
            as="button"
            ref={ref}
            className={classNames("mx_RoomListItemView", {
                mx_RoomListItemView_has_menu: vm.showHoverMenu,
                mx_RoomListItemView_selected: isSelected,
                mx_RoomListItemView_bold: vm.isBold,
            })}
            gap="var(--cpd-space-3x)"
            align="center"
            type="button"
            role="option"
            aria-posinset={index + 1}
            aria-setsize={count}
            aria-selected={isSelected}
            aria-label={vm.a11yLabel}
            onClick={() => vm.openRoom()}
            onFocus={(e: React.FocusEvent<HTMLButtonElement>) => onFocus(room, e)}
            tabIndex={isFocused ? 0 : -1}
            {...props}
        >
            <RoomAvatarView room={room} />
            <Flex
                className="mx_RoomListItemView_content"
                gap="var(--cpd-space-2x)"
                align="center"
                justify="space-between"
            >
                {/* We truncate the room name when too long. Title here is to show the full name on hover */}
                <div className="mx_RoomListItemView_text">
                    <div className="mx_RoomListItemView_roomName" title={vm.name}>
                        {vm.name}
                    </div>
                    {vm.messagePreview && (
                        <div className="mx_RoomListItemView_messagePreview" title={vm.messagePreview}>
                            {vm.messagePreview}
                        </div>
                    )}
                </div>
                {vm.showHoverMenu && <RoomListItemMenuView className="mx_RoomListItemView_menu" room={room} />}

                {/* aria-hidden because we summarise the unread count/notification status in a11yLabel variable */}
                {vm.showNotificationDecoration && (
                    <NotificationDecoration
                        className="mx_RoomListItemView_notificationDecoration"
                        notificationState={vm.notificationState}
                        aria-hidden={true}
                        callType={vm.callType}
                    />
                )}
            </Flex>
        </Flex>
    );

    // Rendering multiple context menus can causes crashes in radix upstream,
    // See https://github.com/radix-ui/primitives/issues/2717.
    if (!vm.showContextMenu) return content;

    return <RoomListItemContextMenuView room={room}>{content}</RoomListItemContextMenuView>;
});

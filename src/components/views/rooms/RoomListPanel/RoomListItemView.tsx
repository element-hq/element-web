/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, memo, useCallback, useEffect, useRef, useState } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";

import { useRoomListItemViewModel } from "../../../viewmodels/roomlist/RoomListItemViewModel";
import { Flex } from "../../../../shared-components/utils/Flex";
import { RoomListItemMenuView } from "./RoomListItemMenuView";
import { NotificationDecoration } from "../NotificationDecoration";
import { RoomAvatarView } from "../../avatars/RoomAvatarView";
import { RoomListItemContextMenuView } from "./RoomListItemContextMenuView";

interface RoomListItemViewProps extends React.HTMLAttributes<HTMLButtonElement> {
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
    onFocus: (e: React.FocusEvent) => void;
    /**
     * The index of the room in the list
     */
    roomIndex: number;
    /**
     * The total number of rooms in the list
     */
    roomCount: number;
    /**
     * Whether the list is currently scrolling
     */
    listIsScrolling: boolean;
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
    listIsScrolling,
    ...props
}: RoomListItemViewProps): JSX.Element {
    const ref = useRef<HTMLButtonElement>(null);
    const vm = useRoomListItemViewModel(room);
    const [isHover, setHover] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // The compound menu in RoomListItemMenuView needs to be rendered when the hover menu is shown
    // Using display: none; and then display:flex when hovered in CSS causes the menu to be misaligned
    const showHoverDecoration = isMenuOpen || isFocused || isHover;
    const showHoverMenu = showHoverDecoration && vm.showHoverMenu;

    const closeMenu = useCallback(() => {
        // To avoid icon blinking when closing the menu, we delay the state update
        // Also, let the focus move to the menu trigger before closing the menu
        setTimeout(() => setIsMenuOpen(false), 10);
    }, []);

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
                mx_RoomListItemView_hover: showHoverDecoration,
                mx_RoomListItemView_menu_open: showHoverMenu,
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
            onFocus={onFocus}
            onMouseOver={() => setHover(true)}
            onMouseOut={() => setHover(false)}
            onBlur={() => setHover(false)}
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
                {showHoverMenu ? (
                    <RoomListItemMenuView
                        room={room}
                        setMenuOpen={(isOpen) => (isOpen ? setIsMenuOpen(true) : closeMenu())}
                    />
                ) : (
                    <>
                        {/* aria-hidden because we summarise the unread count/notification status in a11yLabel variable */}
                        {vm.showNotificationDecoration && (
                            <NotificationDecoration
                                notificationState={vm.notificationState}
                                aria-hidden={true}
                                hasVideoCall={vm.hasParticipantInCall}
                            />
                        )}
                    </>
                )}
            </Flex>
        </Flex>
    );

    // Rendering multiple context menus can causes crashes in radix upstream,
    // See https://github.com/radix-ui/primitives/issues/2717.
    // We also don't need the context menu while scrolling so can improve scroll performance
    // by not rendering it.
    if (!vm.showContextMenu || listIsScrolling) return content;

    return (
        <RoomListItemContextMenuView
            room={room}
            setMenuOpen={(isOpen) => {
                if (isOpen) {
                    // To avoid icon blinking when the context menu is re-opened
                    setTimeout(() => setIsMenuOpen(true), 0);
                } else {
                    closeMenu();
                }
            }}
        >
            {content}
        </RoomListItemContextMenuView>
    );
});

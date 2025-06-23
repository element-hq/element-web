/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, memo, useCallback, useRef, useState } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";

import { useRoomListItemViewModel } from "../../../viewmodels/roomlist/RoomListItemViewModel";
import { Flex } from "../../../utils/Flex";
import { RoomListItemMenuView } from "./RoomListItemMenuView";
import { NotificationDecoration } from "../NotificationDecoration";
import { RoomAvatarView } from "../../avatars/RoomAvatarView";
import { useRovingTabIndex } from "../../../../accessibility/RovingTabIndex";
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
}

/**
 * An item in the room list
 */
export const RoomListItemView = memo(function RoomListItemView({
    room,
    isSelected,
    ...props
}: RoomListItemViewProps): JSX.Element {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [onFocus, isActive, ref] = useRovingTabIndex(buttonRef);

    const vm = useRoomListItemViewModel(room);

    const [isHover, setIsHoverWithDelay] = useIsHover();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // The compound menu in RoomListItemMenuView needs to be rendered when the hover menu is shown
    // Using display: none; and then display:flex when hovered in CSS causes the menu to be misaligned
    const showHoverDecoration = isMenuOpen || isHover;
    const showHoverMenu = showHoverDecoration && vm.showHoverMenu;

    const closeMenu = useCallback(() => {
        // To avoid icon blinking when closing the menu, we delay the state update
        // Also, let the focus move to the menu trigger before closing the menu
        setTimeout(() => setIsMenuOpen(false), 10);
    }, []);

    const content = (
        <button
            ref={ref}
            className={classNames("mx_RoomListItemView", {
                mx_RoomListItemView_hover: showHoverDecoration,
                mx_RoomListItemView_menu_open: showHoverMenu,
                mx_RoomListItemView_selected: isSelected,
                mx_RoomListItemView_bold: vm.isBold,
            })}
            type="button"
            aria-selected={isSelected}
            aria-label={vm.a11yLabel}
            onClick={() => vm.openRoom()}
            onMouseOver={() => setIsHoverWithDelay(true)}
            onMouseOut={() => setIsHoverWithDelay(false)}
            onFocus={() => {
                setIsHoverWithDelay(true);
                onFocus();
            }}
            // Adding a timeout because when tabbing to go to the more options and notification menu, the focus moves out of the button
            // The blur makes the button lose the hover state and these menu are not shown
            // We delay the blur event to give time to the focus to move to the menu
            onBlur={() => setIsHoverWithDelay(false, 10)}
            tabIndex={isActive ? 0 : -1}
            {...props}
        >
            {/* We need this extra div between the button and the content in order to add a padding which is not messing with the virtualized list */}
            <Flex className="mx_RoomListItemView_container" gap="var(--cpd-space-3x)" align="center">
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
                        <div className="mx_RoomListItemView_messagePreview">{vm.messagePreview}</div>
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
        </button>
    );

    if (!vm.showContextMenu) return content;

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

/**
 * Custom hook to manage the hover state of the room list item
 * If the timeout is set, it will set the hover state after the timeout
 * If the timeout is not set, it will set the hover state immediately
 * When the set method is called, it will clear any existing timeout
 *
 * @returns {boolean} isHover - The hover state
 */
function useIsHover(): [boolean, (value: boolean, timeout?: number) => void] {
    const [isHover, setIsHover] = useState(false);
    // Store the timeout ID
    const timeoutRef = useRef<number | undefined>(undefined);

    const setIsHoverWithDelay = useCallback((value: boolean, timeout?: number): void => {
        // Clear the timeout if it exists
        clearTimeout(timeoutRef.current);

        // No delay, set the value immediately
        if (timeout === undefined) {
            setIsHover(value);
            return;
        }

        // Set a timeout to set the value after the delay
        timeoutRef.current = setTimeout(() => setIsHover(value), timeout);
    }, []);

    return [isHover, setIsHoverWithDelay];
}

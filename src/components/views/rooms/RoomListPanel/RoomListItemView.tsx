/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, memo, useState } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";

import { useRoomListItemViewModel } from "../../../viewmodels/roomlist/RoomListItemViewModel";
import { Flex } from "../../../utils/Flex";
import { RoomListItemMenuView } from "./RoomListItemMenuView";
import { NotificationDecoration } from "../NotificationDecoration";
import { RoomAvatarView } from "../../avatars/RoomAvatarView";

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
    const vm = useRoomListItemViewModel(room);

    const [isHover, setIsHover] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // The compound menu in RoomListItemMenuView needs to be rendered when the hover menu is shown
    // Using display: none; and then display:flex when hovered in CSS causes the menu to be misaligned
    const showHoverDecoration = (isMenuOpen || isHover) && vm.showHoverMenu;

    const isNotificationDecorationVisible = !showHoverDecoration && vm.showNotificationDecoration;

    return (
        <button
            className={classNames("mx_RoomListItemView", {
                mx_RoomListItemView_empty: !isNotificationDecorationVisible && !showHoverDecoration,
                mx_RoomListItemView_notification_decoration: isNotificationDecorationVisible,
                mx_RoomListItemView_menu_open: showHoverDecoration,
                mx_RoomListItemView_selected: isSelected,
                mx_RoomListItemView_bold: vm.isBold,
            })}
            type="button"
            aria-selected={isSelected}
            aria-label={vm.a11yLabel}
            onClick={() => vm.openRoom()}
            onMouseOver={() => setIsHover(true)}
            onMouseOut={() => setIsHover(false)}
            onFocus={() => setIsHover(true)}
            onBlur={() => setIsHover(false)}
            {...props}
        >
            {/* We need this extra div between the button and the content in order to add a padding which is not messing with the virtualized list */}
            <Flex className="mx_RoomListItemView_container" gap="var(--cpd-space-3x)" align="center">
                <RoomAvatarView room={room} />
                <Flex
                    className="mx_RoomListItemView_content"
                    gap="var(--cpd-space-3x)"
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
                    {showHoverDecoration ? (
                        <RoomListItemMenuView
                            room={room}
                            setMenuOpen={(isOpen) => {
                                if (isOpen) setIsMenuOpen(isOpen);
                                // To avoid icon blinking when closing the menu, we delay the state update
                                else setTimeout(() => setIsMenuOpen(isOpen), 0);
                            }}
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
});

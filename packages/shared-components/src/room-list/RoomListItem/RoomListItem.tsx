/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import classNames from "classnames";

import { Flex } from "../../utils/Flex";
import { NotificationDecoration, type NotificationDecorationData } from "../../notifications/NotificationDecoration";
import {
    RoomListItemHoverMenu,
    type MoreOptionsMenuState,
    type MoreOptionsMenuCallbacks,
    type NotificationMenuState,
    type NotificationMenuCallbacks,
} from "./RoomListItemHoverMenu";
import { RoomListItemContextMenu } from "./RoomListItemContextMenu";
import styles from "./RoomListItem.module.css";

/**
 * Data interface for a room list item.
 * Contains all the data needed to render a room in the list.
 */
export interface RoomListItem {
    /** Unique identifier for the room (used for list keying) */
    id: string;
    /** The name of the room */
    name: string;
    /** Accessibility label for the room list item */
    a11yLabel: string;
    /** Whether the room name should be bolded (has unread/activity) */
    isBold: boolean;
    /** Optional message preview text */
    messagePreview?: string;
    /** Notification decoration data */
    notification: NotificationDecorationData;
    /** Whether the more options menu should be shown */
    showMoreOptionsMenu: boolean;
    /** Whether the notification menu should be shown */
    showNotificationMenu: boolean;
    /** More options menu state */
    moreOptionsState: MoreOptionsMenuState;
    /** Notification menu state */
    notificationState: NotificationMenuState;
}

/**
 * Callbacks for room list item interactions
 */
export interface RoomListItemCallbacks {
    /** Callback to open the room */
    onOpenRoom: () => void;
    /** More options menu callbacks */
    moreOptionsCallbacks: MoreOptionsMenuCallbacks;
    /** Notification menu callbacks */
    notificationCallbacks: NotificationMenuCallbacks;
}

/**
 * Props for RoomListItemView component
 */
export interface RoomListItemViewProps extends Omit<React.HTMLAttributes<HTMLButtonElement>, "onFocus"> {
    /** The room data to display */
    item: RoomListItem;
    /** The room callbacks */
    callbacks: RoomListItemCallbacks;
    /** Whether the room is currently selected */
    isSelected: boolean;
    /** Whether the room is currently focused */
    isFocused: boolean;
    /** Callback when the item receives focus */
    onFocus: (e: React.FocusEvent) => void;
    /** The index of the room in the list (for accessibility) */
    roomIndex: number;
    /** The total number of rooms in the list (for accessibility) */
    roomCount: number;
    /** Custom avatar component to render */
    avatar: ReactNode;
}

/**
 * A presentational room list item component.
 * Displays room name, avatar, message preview, and notifications.
 * All business logic is handled through callbacks to parent components.
 */
export const RoomListItemView = memo(function RoomListItemView({
    item,
    callbacks,
    isSelected,
    isFocused,
    onFocus,
    roomIndex,
    roomCount,
    avatar,
    ...props
}: RoomListItemViewProps): JSX.Element {
    const ref = useRef<HTMLButtonElement>(null);
    const [isHover, setHover] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // The compound menu needs to be rendered when the hover menu is shown
    // Using display: none; and then display:flex when hovered in CSS causes the menu to be misaligned
    const showHoverDecoration = isMenuOpen || isFocused || isHover;
    const showHoverMenu = showHoverDecoration;

    const closeMenu = useCallback(() => {
        // To avoid icon blinking when closing the menu, we delay the state update
        // Also, let the focus move to the menu trigger before closing the menu
        setTimeout(() => setIsMenuOpen(false), 10);
    }, []);

    useEffect(() => {
        if (isFocused) {
            ref.current?.focus({ preventScroll: true });
        }
    }, [isFocused]);

    const content = (
        <Flex
            as="button"
            ref={ref}
            className={classNames(styles.roomListItem, {
                [styles.hover]: showHoverDecoration,
                [styles.menuOpen]: showHoverMenu,
                [styles.selected]: isSelected,
                [styles.bold]: item.isBold,
            })}
            gap="var(--cpd-space-3x)"
            align="center"
            type="button"
            role="option"
            aria-posinset={roomIndex + 1}
            aria-setsize={roomCount}
            aria-selected={isSelected}
            aria-label={item.a11yLabel}
            onClick={callbacks.onOpenRoom}
            onFocus={onFocus}
            onMouseOver={() => setHover(true)}
            onMouseOut={() => setHover(false)}
            onBlur={() => setHover(false)}
            tabIndex={isFocused ? 0 : -1}
            {...props}
        >
            {avatar}
            <Flex className={styles.content} gap="var(--cpd-space-2x)" align="center" justify="space-between">
                {/* We truncate the room name when too long. Title here is to show the full name on hover */}
                <div className={styles.text}>
                    <div className={styles.roomName} title={item.name}>
                        {item.name}
                    </div>
                    {item.messagePreview && (
                        <div className={styles.messagePreview} title={item.messagePreview}>
                            {item.messagePreview}
                        </div>
                    )}
                </div>
                {showHoverMenu ? (
                    <RoomListItemHoverMenu
                        showMoreOptionsMenu={item.showMoreOptionsMenu}
                        showNotificationMenu={item.showNotificationMenu}
                        moreOptionsState={item.moreOptionsState}
                        moreOptionsCallbacks={callbacks.moreOptionsCallbacks}
                        notificationState={item.notificationState}
                        notificationCallbacks={callbacks.notificationCallbacks}
                        onMenuOpenChange={(isOpen: boolean) => (isOpen ? setIsMenuOpen(true) : closeMenu())}
                    />
                ) : (
                    <>
                        {/* aria-hidden because we summarise the unread count/notification status in a11yLabel */}
                        <div aria-hidden={true}>
                            <NotificationDecoration data={item.notification} />
                        </div>
                    </>
                )}
            </Flex>
        </Flex>
    );

    return (
        <RoomListItemContextMenu
            state={item.moreOptionsState}
            callbacks={callbacks.moreOptionsCallbacks}
            onMenuOpenChange={setIsMenuOpen}
        >
            {content}
        </RoomListItemContextMenu>
    );
});

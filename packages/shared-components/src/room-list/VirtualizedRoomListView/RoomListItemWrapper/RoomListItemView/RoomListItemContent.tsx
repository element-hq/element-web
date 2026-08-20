/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, memo, type ReactNode } from "react";
import { Text, Tooltip } from "@vector-im/compound-web";
import classNames from "classnames";

import { Flex } from "../../../../core/utils/Flex";
import { useViewModel } from "../../../../core/viewmodel";
import { NotificationDecoration } from "./NotificationDecoration";
import { RoomListItemHoverMenu } from "./RoomListItemHoverMenu";
import { type Room, type RoomListItemViewModel } from "./RoomListItemView";
import styles from "./RoomListItemView.module.css";

/**
 * Props for {@link RoomListItemContent}.
 */
export interface RoomListItemContentProps {
    /** The room item view model */
    vm: RoomListItemViewModel;
    /** Function to render the room avatar */
    renderAvatar: (room: Room) => ReactNode;
    /** Whether the item is being dragged */
    isDragging?: boolean;
}

/**
 * The inner content of a room list item: avatar, room name, message preview,
 * hover menu and notification decoration. Used both inside the full
 * {@link RoomListItemView} and inside the drag overlay.
 */
export const RoomListItemContent = memo(function RoomListItemContent({
    vm,
    renderAvatar,
    isDragging = false,
}: RoomListItemContentProps): JSX.Element {
    const item = useViewModel(vm);

    return (
        <Flex
            className={classNames(styles.container, {
                [styles.dragging]: isDragging,
            })}
            gap="var(--cpd-space-3x)"
            align="center"
        >
            {renderAvatar(item.room)}
            <Flex className={styles.content} gap="var(--cpd-space-2x)" align="center" justify="space-between">
                {/*
                    The room name and message preview are truncated when too long, so the full text
                    is offered on hover. These must be rendered tooltips rather than native `title`
                    attributes: on Element Desktop for macOS, `title` tooltips fire on the first
                    hover and then only intermittently, so the text is effectively unreachable.
                        https://github.com/element-hq/element-web/issues/34049
                        https://github.com/electron/electron/issues/49843
                    This follows EventPreviewView, which moved off `title` for the same reason.
                    The name tooltip wraps only the name text, not the whole cell, so that hovering
                    the user status emoji shows its own tooltip rather than both at once.
                */}
                <div className={styles.ellipsis}>
                    <div className={styles.roomName}>
                        <Tooltip description={item.name}>
                            <span data-testid="room-name">{item.name}</span>
                        </Tooltip>
                        {item.userStatus && (
                            <Tooltip description={item.userStatus.text}>
                                <Text as="span" className={styles.userStatusEmoji}>
                                    {item.userStatus.emoji}
                                </Text>
                            </Tooltip>
                        )}
                    </div>

                    {item.messagePreview && (
                        <Tooltip description={item.messagePreview}>
                            <Text as="div" size="sm" className={styles.ellipsis}>
                                {item.messagePreview}
                            </Text>
                        </Tooltip>
                    )}
                </div>
                {!isDragging && (item.showMoreOptionsMenu || item.showNotificationMenu) && (
                    <RoomListItemHoverMenu
                        showMoreOptionsMenu={item.showMoreOptionsMenu}
                        showNotificationMenu={item.showNotificationMenu}
                        vm={vm}
                    />
                )}

                {/* aria-hidden because we summarise the unread count/notification status in a11yLabel */}
                <div className={styles.notificationDecoration} aria-hidden={true}>
                    <NotificationDecoration {...item.notification} />
                </div>
            </Flex>
        </Flex>
    );
});

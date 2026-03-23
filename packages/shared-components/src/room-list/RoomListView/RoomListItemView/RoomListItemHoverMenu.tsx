/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import { Flex } from "../../../core/utils/Flex";
import { RoomListItemMoreOptionsMenu, type RoomListItemViewModel } from "./RoomListItemMoreOptionsMenu";
import { RoomListItemNotificationMenu } from "./RoomListItemNotificationMenu";
import styles from "./RoomListItemView.module.css";

/**
 * Props for RoomListItemHoverMenu component
 */
export interface RoomListItemHoverMenuProps {
    /** Whether the more options menu should be shown */
    showMoreOptionsMenu: boolean;
    /** Whether the notification menu should be shown */
    showNotificationMenu: boolean;
    /** The room item view model */
    vm: RoomListItemViewModel;
}

/**
 * The hover menu for room list items.
 * Displays more options and notification settings menus.
 */
export const RoomListItemHoverMenu: React.FC<RoomListItemHoverMenuProps> = ({
    showMoreOptionsMenu,
    showNotificationMenu,
    vm,
}): JSX.Element => {
    return (
        <Flex className={styles.hoverMenu} align="center" gap="var(--cpd-space-1x)">
            {showMoreOptionsMenu && <RoomListItemMoreOptionsMenu vm={vm} />}
            {showNotificationMenu && <RoomListItemNotificationMenu vm={vm} />}
        </Flex>
    );
};

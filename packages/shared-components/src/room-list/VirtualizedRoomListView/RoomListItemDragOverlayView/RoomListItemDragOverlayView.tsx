/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, memo, type ReactNode } from "react";
import classNames from "classnames";

import { Flex } from "../../../core/utils/Flex";
import {
    type Room,
    RoomListItemContent,
    type RoomListItemViewModel,
} from "../RoomListItemAccessibilityWrapper/RoomListItemView";
import roomListItemStyles from "../RoomListItemAccessibilityWrapper/RoomListItemView/RoomListItemView.module.css";
import styles from "./RoomListItemDragOverlayView.module.css";

/**
 * Props for {@link RoomListItemDragOverlayView}.
 */
export interface RoomListItemDragOverlayViewProps {
    /** The room item view model — same one used by the real list item */
    vm: RoomListItemViewModel;
    /** Function to render the room avatar */
    renderAvatar: (room: Room) => ReactNode;
}

/**
 * Visual clone of a room list item rendered inside the dnd drag overlay.
 *
 * Reuses {@link RoomListItemContent} for the inner layout and adds the outer
 * wrapper styles that the live list item normally provides (height, width,
 * typography), so the floating clone matches a real item.
 */
export const RoomListItemDragOverlayView = memo(function RoomListItemDragOverlayView({
    vm,
    renderAvatar,
}: RoomListItemDragOverlayViewProps): JSX.Element {
    return (
        <Flex className={classNames(roomListItemStyles.roomListItem, styles.dragOverlay)} gap="var(--cpd-space-3x)" align="stretch">
            <RoomListItemContent vm={vm} renderAvatar={renderAvatar} isDragging={true} />
        </Flex>
    );
});

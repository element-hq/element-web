/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { memo, type JSX } from "react";

import { RoomListItemView, type RoomListItemViewProps } from "../RoomListItemView";
import { getItemAccessibleProps } from "../../core/utils/VirtualizedList";

export interface RoomListItemAccessibilityWrapperPros extends RoomListItemViewProps {
    /** Index of this room in the list */
    roomIndex: number;
    /** Index of this room in its section */
    roomIndexInSection: number;
    /** Total number of rooms in the list */
    roomCount: number;
    /** Whether the room list is displayed as a flat list */
    isInFlatList: boolean;
}

/**
 * Wrapper around RoomListItemView that adds accessibility props based on the room's position in the list and whether the list is flat or grouped.
 * In a flat list, each item gets listbox item props. In a grouped list, each item gets treegrid cell props.
 *
 * @example
 * ``
 * <RoomListItemAccessibilityWrapper
 *   roomIndex={0}
 *   roomIndexInSection={0}
 *   roomCount={10}
 *   isInFlatList={true}
 *   {...otherRoomListItemViewProps}
 * />
 * ```
 */
export const RoomListItemAccessibilityWrapper = memo(function RoomListItemAccessibilityWrapper({
    roomIndex,
    roomCount,
    roomIndexInSection,
    isInFlatList,
    ...rest
}: RoomListItemAccessibilityWrapperPros): JSX.Element {
    const itemA11yProps = isInFlatList ? getItemAccessibleProps("listbox", roomIndex, roomCount) : { role: "gridcell" };
    const item = <RoomListItemView {...rest} {...itemA11yProps} />;

    if (isInFlatList) return item;
    return <div {...getItemAccessibleProps("treegrid", roomIndex, roomIndexInSection)}>{item}</div>;
});

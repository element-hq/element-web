/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, type JSX } from "react";
import { AutoSizer, List, type ListRowProps } from "react-virtualized";

import { type RoomListViewState } from "../../../viewmodels/roomlist/RoomListViewModel";
import { _t } from "../../../../languageHandler";
import { RoomListItemView } from "./RoomListItemView";

interface RoomListProps {
    /**
     * The view model state for the room list.
     */
    vm: RoomListViewState;
}

/**
 * A virtualized list of rooms.
 */
export function RoomList({ vm: { rooms, activeIndex } }: RoomListProps): JSX.Element {
    const roomRendererMemoized = useCallback(
        ({ key, index, style }: ListRowProps) => (
            <RoomListItemView room={rooms[index]} key={key} style={style} isSelected={activeIndex === index} />
        ),
        [rooms, activeIndex],
    );

    // The first div is needed to make the virtualized list take all the remaining space and scroll correctly
    return (
        <div className="mx_RoomList" data-testid="room-list">
            <AutoSizer>
                {({ height, width }) => (
                    <List
                        aria-label={_t("room_list|list_title")}
                        className="mx_RoomList_List"
                        rowRenderer={roomRendererMemoized}
                        rowCount={rooms.length}
                        rowHeight={48}
                        height={height}
                        width={width}
                        scrollToIndex={activeIndex ?? 0}
                    />
                )}
            </AutoSizer>
        </div>
    );
}

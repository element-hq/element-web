/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, type JSX } from "react";
import { AutoSizer, List, type ListRowProps } from "react-virtualized";

import type { Room } from "../../../../../../matrix-js-sdk/src";
import { type RoomListViewState } from "../../../viewmodels/roomlist/RoomListViewModel";
import DecoratedRoomAvatar from "../../avatars/DecoratedRoomAvatar";
import { _t } from "../../../../languageHandler";
import { Flex } from "../../../utils/Flex";

interface RoomListProps {
    vm: RoomListViewState;
}

export function RoomList({ vm: { rooms } }: RoomListProps): JSX.Element {
    const roomRendererMemoized = useCallback(
        (listRowProps: ListRowProps) => roomRenderer(rooms, listRowProps),
        [rooms],
    );

    return (
        <AutoSizer>
            {({ height, width }) => (
                <List
                    aria-label={_t("room_list|list_title")}
                    className="mx_RoomList"
                    rowRenderer={roomRendererMemoized}
                    rowCount={rooms.length}
                    rowHeight={48}
                    height={height}
                    width={width}
                />
            )}
        </AutoSizer>
    );
}

function roomRenderer(rooms: Room[], { key, index, style }: ListRowProps): JSX.Element {
    const room = rooms[index];
    return (
        <button
            className="mx_RoomList_roomRenderer"
            type="button"
            key={key}
            style={style}
            aria-label={_t("room_list|room|Open room %(roomName)s", { roomName: room.name })}
        >
            <div className="mx_RoomList_roomRenderer_container">
                <DecoratedRoomAvatar room={room} size="32px" />
                <Flex className="mx_RoomList_roomRenderer_content" align="center">
                    {room.name}
                    {/* Future hover menu et notification badges */}
                </Flex>
            </div>
        </button>
    );
}

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useCallback, useEffect, useState } from "react";

import { SdkContextClass } from "../../../contexts/SDKContext";
import { useDispatcher } from "../../../hooks/useDispatcher";
import dispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import type { Room } from "matrix-js-sdk/src/matrix";
import type { Optional } from "matrix-events-sdk";

function getIndexByRoomId(rooms: Room[], roomId: Optional<string>): number | undefined {
    const index = rooms.findIndex((room) => room.roomId === roomId);
    return index === -1 ? undefined : index;
}

function getRoomsWithStickyRoom(
    rooms: Room[],
    oldIndex: number | undefined,
    newIndex: number | undefined,
    isRoomChange: boolean,
): { newRooms: Room[]; newIndex: number | undefined } {
    const updated = { newIndex, newRooms: rooms };
    if (isRoomChange) {
        /*
         * When opening another room, the index should obviously change.
         */
        return updated;
    }
    if (newIndex === undefined || oldIndex === undefined) {
        /*
         * If oldIndex is undefined, then there was no active room before.
         * So nothing to do in regards to sticky room.
         * Similarly, if newIndex is undefined, there's no active room anymore.
         */
        return updated;
    }
    if (newIndex === oldIndex) {
        /*
         * If the index hasn't changed, we have nothing to do.
         */
        return updated;
    }
    if (oldIndex > rooms.length - 1) {
        /*
         * If the old index falls out of the bounds of the rooms array
         * (usually because rooms were removed), we can no longer place
         * the active room in the same old index.
         */
        return updated;
    }

    /*
     * Making the active room sticky is as simple as removing it from
     * its new index and placing it in the old index.
     */
    const newRooms = [...rooms];
    const [newRoom] = newRooms.splice(newIndex, 1);
    newRooms.splice(oldIndex, 0, newRoom);

    return { newIndex: oldIndex, newRooms };
}

interface StickyRoomListResult {
    /**
     * List of rooms with sticky active room.
     */
    rooms: Room[];
    /**
     * Index of the active room in the room list.
     */
    activeIndex: number | undefined;
}

/**
 * - Provides a list of rooms such that the active room is sticky i.e the active room is kept
 * in the same index even when the order of rooms in the list changes.
 * - Provides the index of the active room.
 * @param rooms list of rooms
 * @see {@link StickyRoomListResult} details what this hook returns..
 */
export function useStickyRoomList(rooms: Room[]): StickyRoomListResult {
    const [listState, setListState] = useState<{ index: number | undefined; roomsWithStickyRoom: Room[] }>({
        index: undefined,
        roomsWithStickyRoom: rooms,
    });

    const updateRoomsAndIndex = useCallback(
        (newRoomId?: string, isRoomChange: boolean = false) => {
            setListState((current) => {
                const activeRoomId = newRoomId ?? SdkContextClass.instance.roomViewStore.getRoomId();
                const newActiveIndex = getIndexByRoomId(rooms, activeRoomId);
                const oldIndex = current.index;
                const { newIndex, newRooms } = getRoomsWithStickyRoom(rooms, oldIndex, newActiveIndex, isRoomChange);
                return { index: newIndex, roomsWithStickyRoom: newRooms };
            });
        },
        [rooms],
    );

    // Re-calculate the index when the active room has changed.
    useDispatcher(dispatcher, (payload) => {
        if (payload.action === Action.ActiveRoomChanged) updateRoomsAndIndex(payload.newRoomId, true);
    });

    // Re-calculate the index when the list of rooms has changed.
    useEffect(() => {
        updateRoomsAndIndex();
    }, [rooms, updateRoomsAndIndex]);

    return { activeIndex: listState.index, rooms: listState.roomsWithStickyRoom };
}

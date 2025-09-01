/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { SdkContextClass } from "../../../contexts/SDKContext";
import { useDispatcher } from "../../../hooks/useDispatcher";
import dispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import type { Room } from "matrix-js-sdk/src/matrix";
import type { Optional } from "matrix-events-sdk";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import { type RoomsResult } from "../../../stores/room-list-v3/RoomListStoreV3";

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

export interface StickyRoomListResult {
    /**
     * The rooms result with the active sticky room applied
     */
    roomsResult: RoomsResult;
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
export function useStickyRoomList(roomsResult: RoomsResult): StickyRoomListResult {
    const [listState, setListState] = useState<StickyRoomListResult>({
        activeIndex: getIndexByRoomId(roomsResult.rooms, SdkContextClass.instance.roomViewStore.getRoomId()),
        roomsResult: roomsResult,
    });

    const currentSpaceRef = useRef(SpaceStore.instance.activeSpace);

    const updateRoomsAndIndex = useCallback(
        (newRoomId: string | null, isRoomChange: boolean = false) => {
            setListState((current) => {
                const activeRoomId = newRoomId ?? SdkContextClass.instance.roomViewStore.getRoomId();
                const newActiveIndex = getIndexByRoomId(roomsResult.rooms, activeRoomId);
                const oldIndex = current.activeIndex;
                const { newIndex, newRooms } = getRoomsWithStickyRoom(
                    roomsResult.rooms,
                    oldIndex,
                    newActiveIndex,
                    isRoomChange,
                );
                return { activeIndex: newIndex, roomsResult: { ...roomsResult, rooms: newRooms } };
            });
        },
        [roomsResult],
    );

    // Re-calculate the index when the active room has changed.
    useDispatcher(dispatcher, (payload) => {
        if (payload.action === Action.ActiveRoomChanged) updateRoomsAndIndex(payload.newRoomId, true);
    });

    // Re-calculate the index when the list of rooms has changed.
    useEffect(() => {
        let newRoomId: string | null = null;
        let isRoomChange = false;
        if (currentSpaceRef.current !== roomsResult.spaceId) {
            /*
            If the space has changed, we check if we can immediately set the active
            index to the last opened room in that space. Otherwise, we might see a
            flicker because of the delay between the space change event and
            active room change dispatch.
            */
            newRoomId = SpaceStore.instance.getLastSelectedRoomIdForSpace(roomsResult.spaceId);
            isRoomChange = true;
            currentSpaceRef.current = roomsResult.spaceId;
        }
        updateRoomsAndIndex(newRoomId, isRoomChange);
    }, [roomsResult, updateRoomsAndIndex]);

    return listState;
}

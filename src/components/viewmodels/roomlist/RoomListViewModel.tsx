/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback } from "react";

import type { Room } from "matrix-js-sdk/src/matrix";
import { type PrimaryFilter, useFilteredRooms } from "./useFilteredRooms";
import { createRoom as createRoomFunc, hasCreateRoomRights } from "./utils";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { UPDATE_SELECTED_SPACE } from "../../../stores/spaces";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import dispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useStickyRoomList } from "./useStickyRoomList";
import { useRoomListNavigation } from "./useRoomListNavigation";

export interface RoomListViewState {
    /**
     * Whether the list of rooms is being loaded.
     */
    isLoadingRooms: boolean;

    /**
     * A list of rooms to be displayed in the left panel.
     */
    rooms: Room[];

    /**
     * Create a chat room
     * @param e - The click event
     */
    createChatRoom: () => void;

    /**
     * Whether the user can create a room in the current space
     */
    canCreateRoom: boolean;

    /**
     * Create a room
     * @param e - The click event
     */
    createRoom: () => void;

    /**
     * A list of objects that provide the view enough information
     * to render primary room filters.
     */
    primaryFilters: PrimaryFilter[];

    /**
     * The currently active primary filter.
     * If no primary filter is active, this will be undefined.
     */
    activePrimaryFilter?: PrimaryFilter;

    /**
     * The index of the active room in the room list.
     */
    activeIndex: number | undefined;
}

/**
 * View model for the new room list
 * @see {@link RoomListViewState} for more information about what this view model returns.
 */
export function useRoomListViewModel(): RoomListViewState {
    const matrixClient = useMatrixClientContext();
    const { isLoadingRooms, primaryFilters, activePrimaryFilter, rooms: filteredRooms } = useFilteredRooms();
    const { activeIndex, rooms } = useStickyRoomList(filteredRooms);

    useRoomListNavigation(rooms);

    const currentSpace = useEventEmitterState<Room | null>(
        SpaceStore.instance,
        UPDATE_SELECTED_SPACE,
        () => SpaceStore.instance.activeSpaceRoom,
    );
    const canCreateRoom = hasCreateRoomRights(matrixClient, currentSpace);

    const createChatRoom = useCallback(() => dispatcher.fire(Action.CreateChat), []);
    const createRoom = useCallback(() => createRoomFunc(currentSpace), [currentSpace]);

    return {
        isLoadingRooms,
        rooms,
        canCreateRoom,
        createRoom,
        createChatRoom,
        primaryFilters,
        activePrimaryFilter,
        activeIndex,
    };
}

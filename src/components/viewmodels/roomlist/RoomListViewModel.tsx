/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback } from "react";

import type { Room } from "matrix-js-sdk/src/matrix";
import { type PrimaryFilter, type SecondaryFilters, useFilteredRooms } from "./useFilteredRooms";
import { type SortOption, useSorter } from "./useSorter";
import { useMessagePreviewToggle } from "./useMessagePreviewToggle";
import { createRoom as createRoomFunc, hasCreateRoomRights } from "./utils";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { UPDATE_SELECTED_SPACE } from "../../../stores/spaces";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import dispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useStickyRoomList } from "./useStickyRoomList";

export interface RoomListViewState {
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
     * A function to activate a given secondary filter.
     */
    activateSecondaryFilter: (filter: SecondaryFilters) => void;

    /**
     * The currently active secondary filter.
     */
    activeSecondaryFilter: SecondaryFilters;

    /**
     * Change the sort order of the room-list.
     */
    sort: (option: SortOption) => void;

    /**
     * The currently active sort option.
     */
    activeSortOption: SortOption;

    /**
     * Whether message previews must be shown or not.
     */
    shouldShowMessagePreview: boolean;

    /**
     * A function to turn on/off message previews.
     */
    toggleMessagePreview: () => void;

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
    const {
        primaryFilters,
        activePrimaryFilter,
        rooms: filteredRooms,
        activateSecondaryFilter,
        activeSecondaryFilter,
    } = useFilteredRooms();
    const { activeIndex, rooms } = useStickyRoomList(filteredRooms);

    const currentSpace = useEventEmitterState<Room | null>(
        SpaceStore.instance,
        UPDATE_SELECTED_SPACE,
        () => SpaceStore.instance.activeSpaceRoom,
    );
    const canCreateRoom = hasCreateRoomRights(matrixClient, currentSpace);

    const { activeSortOption, sort } = useSorter();
    const { shouldShowMessagePreview, toggleMessagePreview } = useMessagePreviewToggle();

    const createChatRoom = useCallback(() => dispatcher.fire(Action.CreateChat), []);
    const createRoom = useCallback(() => createRoomFunc(currentSpace), [currentSpace]);

    return {
        rooms,
        canCreateRoom,
        createRoom,
        createChatRoom,
        primaryFilters,
        activePrimaryFilter,
        activateSecondaryFilter,
        activeSecondaryFilter,
        activeSortOption,
        sort,
        shouldShowMessagePreview,
        toggleMessagePreview,
        activeIndex,
    };
}

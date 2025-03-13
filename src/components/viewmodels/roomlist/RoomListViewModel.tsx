/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback } from "react";

import type { Room } from "matrix-js-sdk/src/matrix";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import dispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { type PrimaryFilter, type SecondaryFilters, useFilteredRooms } from "./useFilteredRooms";

export interface RoomListViewState {
    /**
     * A list of rooms to be displayed in the left panel.
     */
    rooms: Room[];

    /**
     * Open the room having given roomId.
     */
    openRoom: (roomId: string) => void;

    /**
     * A list of objects that provide the view enough information
     * to render primary room filters.
     */
    primaryFilters: PrimaryFilter[];

    /**
     * A function to activate a given secondary filter.
     */
    activateSecondaryFilter: (filter: SecondaryFilters) => void;

    /**
     * The currently active secondary filter.
     */
    activeSecondaryFilter: SecondaryFilters;
}

/**
 * View model for the new room list
 * @see {@link RoomListViewState} for more information about what this view model returns.
 */
export function useRoomListViewModel(): RoomListViewState {
    const { primaryFilters, rooms, activateSecondaryFilter, activeSecondaryFilter } = useFilteredRooms();

    const openRoom = useCallback((roomId: string): void => {
        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: roomId,
            metricsTrigger: "RoomList",
        });
    }, []);

    return {
        rooms,
        openRoom,
        primaryFilters,
        activateSecondaryFilter,
        activeSecondaryFilter,
    };
}

/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useState } from "react";

import type { Room } from "matrix-js-sdk/src/matrix";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import RoomListStoreV3 from "../../../stores/room-list-v3/RoomListStoreV3";
import { useEventEmitter } from "../../../hooks/useEventEmitter";
import { LISTS_UPDATE_EVENT } from "../../../stores/room-list/RoomListStore";
import dispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";

export interface RoomListViewState {
    /**
     * A list of rooms to be displayed in the left panel.
     */
    rooms: Room[];

    /**
     * Open the room having given roomId.
     */
    openRoom: (roomId: string) => void;
}

/**
 * View model for the new room list
 * @see {@link RoomListViewState} for more information about what this view model returns.
 */
export function useRoomListViewModel(): RoomListViewState {
    const [rooms, setRooms] = useState(RoomListStoreV3.instance.getSortedRoomInActiveSpace());

    useEventEmitter(RoomListStoreV3.instance, LISTS_UPDATE_EVENT, () => {
        const newRooms = RoomListStoreV3.instance.getSortedRoomInActiveSpace();
        setRooms(newRooms);
    });

    const openRoom = useCallback((roomId: string): void => {
        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: roomId,
            metricsTrigger: "RoomList",
        });
    }, []);

    return { rooms, openRoom };
}

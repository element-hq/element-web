/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import RoomListStoreV3 from "../../../stores/room-list-v3/RoomListStoreV3";

export interface RoomListViewState {
    rooms: Room[];
}

export function useRoomListViewModel(): RoomListViewState {
    const rooms = RoomListStoreV3.instance.getSortedRooms();
    return { rooms };
}

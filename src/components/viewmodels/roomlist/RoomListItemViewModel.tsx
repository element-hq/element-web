/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useCallback } from "react";

import dispatcher from "../../../dispatcher/dispatcher";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../../dispatcher/actions";

export interface RoomListItemViewState {
    /**
     * Open the room having given roomId.
     */
    openRoom: (roomId: string) => void;
}

/**
 * View model for the room list item
 * @see {@link RoomListItemViewState} for more information about what this view model returns.
 */
export function useRoomListItemViewModel(): RoomListItemViewState {
    const openRoom = useCallback((roomId: string): void => {
        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: roomId,
            metricsTrigger: "RoomList",
        });
    }, []);

    return { openRoom };
}

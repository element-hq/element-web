/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useCallback } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import dispatcher from "../../../dispatcher/dispatcher";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../../dispatcher/actions";
import { hasAccessToOptionsMenu } from "./utils";

export interface RoomListItemViewState {
    /**
     * Whether the hover menu should be shown.
     */
    showHoverMenu: boolean;
    /**
     * Open the room having given roomId.
     */
    openRoom: () => void;
}

/**
 * View model for the room list item
 * @see {@link RoomListItemViewState} for more information about what this view model returns.
 */
export function useRoomListItemViewModel(room: Room): RoomListItemViewState {
    // incoming: Check notification menu rights
    const showHoverMenu = hasAccessToOptionsMenu(room);

    // Actions

    const openRoom = useCallback((): void => {
        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: room.roomId,
            metricsTrigger: "RoomList",
        });
    }, [room]);

    return {
        showHoverMenu,
        openRoom,
    };
}

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";

import dispatcher from "../../../dispatcher/dispatcher";
import { useDispatcher } from "../../../hooks/useDispatcher";
import { Action } from "../../../dispatcher/actions";
import { type ViewRoomDeltaPayload } from "../../../dispatcher/payloads/ViewRoomDeltaPayload";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { SdkContextClass } from "../../../contexts/SDKContext";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";

/**
 * Hook to navigate the room list using keyboard shortcuts.
 * It listens to the ViewRoomDelta action and updates the room list accordingly.
 * @param rooms
 */
export function useRoomListNavigation(rooms: Room[]): void {
    useDispatcher(dispatcher, (payload) => {
        if (payload.action !== Action.ViewRoomDelta) return;
        const roomId = SdkContextClass.instance.roomViewStore.getRoomId();
        if (!roomId) return;

        const { delta, unread } = payload as ViewRoomDeltaPayload;
        const filteredRooms = unread
            ? // Filter the rooms to only include unread ones and the active room
              rooms.filter((room) => {
                  const state = RoomNotificationStateStore.instance.getRoomState(room);
                  return room.roomId === roomId || state.isUnread;
              })
            : rooms;

        const currentIndex = filteredRooms.findIndex((room) => room.roomId === roomId);
        if (currentIndex === -1) return;

        // Get the next/previous new room according to the delta
        // Use slice to loop on the list
        // If delta is -1 at the start of the list, it will go to the end
        // If delta is 1 at the end of the list, it will go to the start
        const [newRoom] = filteredRooms.slice((currentIndex + delta) % filteredRooms.length);
        if (!newRoom) return;

        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: newRoom.roomId,
            show_room_tile: true, // to make sure the room gets scrolled into view
            metricsTrigger: "WebKeyboardShortcut",
            metricsViaKeyboard: true,
        });
    });
}

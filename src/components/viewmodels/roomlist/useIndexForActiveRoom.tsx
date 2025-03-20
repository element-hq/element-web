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

/**
 * Tracks the index of the active room in the given array of rooms.
 * @param rooms list of rooms
 * @returns index of the active room or undefined otherwise.
 */
export function useIndexForActiveRoom(rooms: Room[]): number | undefined {
    const [index, setIndex] = useState<number | undefined>(undefined);

    const calculateIndex = useCallback(
        (newRoomId?: string) => {
            const activeRoomId = newRoomId ?? SdkContextClass.instance.roomViewStore.getRoomId();
            const index = rooms.findIndex((room) => room.roomId === activeRoomId);
            setIndex(index === -1 ? undefined : index);
        },
        [rooms],
    );

    // Re-calculate the index when the active room has changed.
    useDispatcher(dispatcher, (payload) => {
        if (payload.action === Action.ActiveRoomChanged) calculateIndex(payload.newRoomId);
    });

    // Re-calculate the index when the list of rooms has changed.
    useEffect(() => {
        calculateIndex();
    }, [calculateIndex, rooms]);

    return index;
}

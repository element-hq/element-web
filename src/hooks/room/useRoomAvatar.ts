/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useState } from "react";
import { EventType, type MatrixEvent, type Room, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { type Optional } from "matrix-events-sdk";

import { useTypedEventEmitter } from "../useEventEmitter";

/**
 * Helper to retrieve the avatar for given room
 * @param room
 * @returns the current avatar
 */
export function useRoomAvatar(room?: Room): Optional<string> {
    const [topic, setAvatar] = useState(room?.getMxcAvatarUrl());
    useTypedEventEmitter(room?.currentState, RoomStateEvent.Events, (ev: MatrixEvent) => {
        if (ev.getType() !== EventType.RoomAvatar) return;
        setAvatar(room?.getMxcAvatarUrl());
    });
    useEffect(() => {
        setAvatar(room?.getMxcAvatarUrl());
    }, [room]);

    return topic;
}

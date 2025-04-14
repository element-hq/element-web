/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useState } from "react";
import { EventType, type MatrixEvent, type Room, RoomStateEvent } from "matrix-js-sdk/src/matrix";

import { useTypedEventEmitter } from "../useEventEmitter";

/**
 * Helper to retrieve the avatar for given room
 * @returns the current avatar
 */
export function useRoomAvatar(room?: Room): string | undefined {
    const [avatarMxc, setAvatar] = useState(room?.getMxcAvatarUrl() ?? undefined);
    useTypedEventEmitter(room?.currentState, RoomStateEvent.Events, (ev: MatrixEvent) => {
        if (ev.getType() !== EventType.RoomAvatar) return;
        setAvatar(room?.getMxcAvatarUrl() ?? undefined);
    });
    useEffect(() => {
        setAvatar(room?.getMxcAvatarUrl() ?? undefined);
    }, [room]);

    return avatarMxc;
}

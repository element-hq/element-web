/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, JoinRule, type MatrixEvent, type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { useEffect, useState } from "react";

import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";
import { useDmMember, usePresence, type Presence } from "../../views/avatars/WithPresenceIndicator";

export interface RoomAvatarViewState {
    /**
     * Whether the room avatar has a decoration.
     * A decoration can be a public or a video call icon or an indicator of presence.
     */
    hasDecoration: boolean;
    /**
     * Whether the room is public.
     */
    isPublic: boolean;
    /**
     * Whether the room is a video room.
     */
    isVideoRoom: boolean;
    /**
     * The presence of the user in the DM room.
     * If null, the user is not in a DM room or presence is not enabled.
     */
    presence: Presence | null;
}

/**
 * Hook to get the state of the room avatar.
 * @param room
 */
export function useRoomAvatarViewModel(room: Room): RoomAvatarViewState {
    const isVideoRoom = room.isElementVideoRoom() || room.isCallRoom();
    const roomMember = useDmMember(room);
    const presence = usePresence(room, roomMember);
    const isPublic = useIsPublic(room);

    const hasDecoration = isPublic || isVideoRoom || presence !== null;

    return { hasDecoration, isPublic, isVideoRoom, presence };
}

/**
 * Hook listening to the room join rules.
 * Return true if the room is public.
 * @param room
 */
function useIsPublic(room: Room): boolean {
    const [isPublic, setIsPublic] = useState(isRoomPublic(room));
    // We don't use `useTypedEventEmitterState` because we don't want to update `isPublic` value at every `RoomEvent.Timeline` event.
    useTypedEventEmitter(room, RoomEvent.Timeline, (ev: MatrixEvent, _room: Room) => {
        if (room.roomId !== _room.roomId) return;
        if (ev.getType() !== EventType.RoomJoinRules && ev.getType() !== EventType.RoomMember) return;

        setIsPublic(isRoomPublic(_room));
    });

    // Reset the value when the room changes
    useEffect(() => {
        setIsPublic(isRoomPublic(room));
    }, [room]);

    return isPublic;
}

/**
 * Whether the room is public.
 * @param room
 */
function isRoomPublic(room: Room): boolean {
    return room.getJoinRule() === JoinRule.Public;
}

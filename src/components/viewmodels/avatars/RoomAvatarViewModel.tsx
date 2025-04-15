/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    EventType,
    JoinRule,
    type MatrixEvent,
    type Room,
    RoomEvent,
    type User,
    UserEvent,
} from "matrix-js-sdk/src/matrix";
import { useEffect, useState } from "react";

import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";
import { BUSY_PRESENCE_NAME } from "../../views/rooms/PresenceLabel";
import { useDmMember } from "../../views/avatars/WithPresenceIndicator";
import { isPresenceEnabled } from "../../../utils/presence";

/**
 * The presence of a user in a DM room.
 * - "online": The user is online.
 * - "offline": The user is offline.
 * - "busy": The user is busy.
 * - "unavailable": the presence is unavailable.
 * - null: the user is not in a DM room or presence is not enabled.
 */
export type Presence = "online" | "offline" | "busy" | "unavailable" | null;

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
    presence: Presence;
}

/**
 * Hook to get the state of the room avatar.
 * @param room
 */
export function useRoomAvatarViewModel(room: Room): RoomAvatarViewState {
    const isVideoRoom = room.isElementVideoRoom() || room.isCallRoom();
    const presence = useDMPresence(room);
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

/**
 * Hook listening to the presence of the DM user.
 * @param room
 */
function useDMPresence(room: Room): Presence {
    const roomMember = useDmMember(room);
    const isEnabled = isPresenceEnabled(room.client);

    // If the presence is not enabled, we don't need to listen to the DM user presence.
    const dmUser = isEnabled ? roomMember?.user : undefined;
    const [presence, setPresence] = useState<Presence>(getPresence(dmUser));
    useTypedEventEmitter(dmUser, UserEvent.Presence, () => setPresence(getPresence(dmUser)));
    useTypedEventEmitter(dmUser, UserEvent.CurrentlyActive, () => setPresence(getPresence(dmUser)));

    // Reset the value when the room dmUser changes
    useEffect(() => {
        setPresence(getPresence(dmUser));
    }, [dmUser]);

    return presence;
}

/**
 * Get the presence of the DM user.
 * @param dmUser
 */
function getPresence(dmUser: User | undefined): Presence {
    if (!dmUser) return null;
    if (BUSY_PRESENCE_NAME.matches(dmUser.presence)) return "busy";

    const isOnline = dmUser.currentlyActive || dmUser.presence === "online";
    if (isOnline) return "online";

    if (dmUser.presence === "offline") return "offline";
    if (dmUser.presence === "unavailable") return "unavailable";

    return null;
}

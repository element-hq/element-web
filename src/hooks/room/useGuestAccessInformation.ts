/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useMemo } from "react";
import { EventType, JoinRule, type Room } from "matrix-js-sdk/src/matrix";

import SdkConfig from "../../SdkConfig";
import { useRoomState } from "../useRoomState";

interface GuestAccessInformation {
    canInviteGuests: boolean;
    guestSpaUrl?: string;
    isRoomJoinable: () => boolean;
    canInvite: boolean;
}

/**
 * Helper to retrieve the guest access related information for a room.
 * @param room
 * @returns The GuestAccessInformation which helps decide what options the user should be given.
 */
export const useGuestAccessInformation = (room: Room): GuestAccessInformation => {
    const guestSpaUrl = useMemo(() => {
        return SdkConfig.get("element_call").guest_spa_url;
    }, []);

    // We use the direct function only in functions triggered by user interaction to avoid computation on every render.
    const { joinRule, canInvite, canChangeJoinRule } = useRoomState(room, (roomState) => ({
        joinRule: room.getJoinRule(),
        canInvite: room.canInvite(room.myUserId),
        canChangeJoinRule: roomState.maySendStateEvent(EventType.RoomJoinRules, room.myUserId),
    }));
    const isRoomJoinable = useMemo(
        () => joinRule === JoinRule.Public || (joinRule === JoinRule.Knock && canInvite),
        [canInvite, joinRule],
    );
    const canInviteGuests = useMemo(
        () => (canChangeJoinRule || isRoomJoinable) && guestSpaUrl !== undefined,
        [canChangeJoinRule, isRoomJoinable, guestSpaUrl],
    );

    const isRoomJoinableFunction = (): boolean => {
        const join = room.getJoinRule();
        return join === JoinRule.Public || (join === JoinRule.Knock && room.canInvite(room.myUserId));
    };

    return { canInviteGuests, guestSpaUrl, isRoomJoinable: isRoomJoinableFunction, canInvite };
};

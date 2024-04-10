/*
Copyright 2024 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { useMemo } from "react";
import { EventType, JoinRule, Room } from "matrix-js-sdk/src/matrix";

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

    const isRoomJoinableFunction = (): boolean =>
        room.getJoinRule() === JoinRule.Public || (joinRule === JoinRule.Knock && room.canInvite(room.myUserId));
    return { canInviteGuests, guestSpaUrl, isRoomJoinable: isRoomJoinableFunction, canInvite };
};

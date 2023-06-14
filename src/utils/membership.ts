/*
Copyright 2020 - 2022 The Matrix.org Foundation C.I.C.

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

import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { RoomState, RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

/**
 * Approximation of a membership status for a given room.
 */
export enum EffectiveMembership {
    /**
     * The user is effectively joined to the room. For example, actually joined
     * or knocking on the room (when that becomes possible).
     */
    Join = "JOIN",

    /**
     * The user is effectively invited to the room. Currently this is a direct map
     * to the invite membership as no other membership states are effectively
     * invites.
     */
    Invite = "INVITE",

    /**
     * The user is effectively no longer in the room. For example, kicked,
     * banned, or voluntarily left.
     */
    Leave = "LEAVE",
}

export type MembershipSplit = {
    [state in EffectiveMembership]: Room[];
};

export function splitRoomsByMembership(rooms: Room[]): MembershipSplit {
    const split: MembershipSplit = {
        [EffectiveMembership.Invite]: [],
        [EffectiveMembership.Join]: [],
        [EffectiveMembership.Leave]: [],
    };

    for (const room of rooms) {
        split[getEffectiveMembership(room.getMyMembership())].push(room);
    }

    return split;
}

export function getEffectiveMembership(membership: string): EffectiveMembership {
    if (membership === "invite") {
        return EffectiveMembership.Invite;
    } else if (membership === "join") {
        // TODO: Include knocks? Update docs as needed in the enum. https://github.com/vector-im/element-web/issues/14237
        return EffectiveMembership.Join;
    } else {
        // Probably a leave, kick, or ban
        return EffectiveMembership.Leave;
    }
}

export function isJoinedOrNearlyJoined(membership: string): boolean {
    const effective = getEffectiveMembership(membership);
    return effective === EffectiveMembership.Join || effective === EffectiveMembership.Invite;
}

/**
 * Try to ensure the user is already in the megolm session before continuing
 * NOTE: this assumes you've just created the room and there's not been an opportunity
 * for other code to run, so we shouldn't miss RoomState.newMember when it comes by.
 */
export async function waitForMember(
    client: MatrixClient,
    roomId: string,
    userId: string,
    opts = { timeout: 1500 },
): Promise<boolean> {
    const { timeout } = opts;
    let handler: (event: MatrixEvent, state: RoomState, member: RoomMember) => void;
    return new Promise<boolean>((resolve) => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        handler = function (_, __, member: RoomMember) {
            if (member.userId !== userId) return;
            if (member.roomId !== roomId) return;
            resolve(true);
        };
        client.on(RoomStateEvent.NewMember, handler);

        /* We don't want to hang if this goes wrong, so we proceed and hope the other
           user is already in the megolm session */
        window.setTimeout(resolve, timeout, false);
    }).finally(() => {
        client.removeListener(RoomStateEvent.NewMember, handler);
    });
}

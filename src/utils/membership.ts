/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type Room,
    type RoomMember,
    type RoomState,
    RoomStateEvent,
    type MatrixEvent,
    type MatrixClient,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership, type Membership } from "matrix-js-sdk/src/types";

import { MatrixClientPeg } from "../MatrixClientPeg";
import SettingsStore from "../settings/SettingsStore";

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
        const membership = room.getMyMembership();
        // Filter out falsey relationship as this will be peeked rooms
        if (!!membership) {
            split[getEffectiveMembershipTag(room)].push(room);
        }
    }

    return split;
}

export function getEffectiveMembership(membership: Membership): EffectiveMembership {
    if (membership === KnownMembership.Invite) {
        return EffectiveMembership.Invite;
    } else if (
        membership === KnownMembership.Join ||
        (SettingsStore.getValue("feature_ask_to_join") && membership === KnownMembership.Knock)
    ) {
        return EffectiveMembership.Join;
    } else {
        // Probably a leave, kick, or ban
        return EffectiveMembership.Leave;
    }
}

export function isKnockDenied(room: Room): boolean | undefined {
    const memberId = MatrixClientPeg.get()?.getSafeUserId();
    const member = memberId ? room.getMember(memberId) : null;
    const previousMembership = member?.events.member?.getPrevContent().membership;

    return member?.isKicked() && previousMembership === KnownMembership.Knock;
}

export function getEffectiveMembershipTag(room: Room, membership?: string): EffectiveMembership {
    return isKnockDenied(room)
        ? EffectiveMembership.Join
        : getEffectiveMembership(membership ?? room.getMyMembership());
}

export function isJoinedOrNearlyJoined(membership: Membership): boolean {
    const effective = getEffectiveMembership(membership);
    return effective === EffectiveMembership.Join || effective === EffectiveMembership.Invite;
}

/**
 * Try to ensure the user is in the room (invited or joined) before continuing
 */
export async function waitForMember(
    client: MatrixClient,
    roomId: string,
    userId: string,
    opts = { timeout: 1500 },
): Promise<boolean> {
    const { timeout } = opts;
    let handler: (event: MatrixEvent, state: RoomState, member: RoomMember) => void;

    // check if the user is in the room before we start -- in which case, no need to wait.
    if ((client.getRoom(roomId)?.getMember(userId) ?? null) !== null) {
        return true;
    }

    return new Promise<boolean>((resolve) => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        handler = function (_, __, member: RoomMember) {
            if (member.userId !== userId) return;
            if (member.roomId !== roomId) return;
            resolve(true);
        };
        client.on(RoomStateEvent.NewMember, handler);

        /* We don't want to hang if this goes wrong, so we proceed and hope the other
           user is already in the room */
        window.setTimeout(resolve, timeout, false);
    }).finally(() => {
        client.removeListener(RoomStateEvent.NewMember, handler);
    });
}

/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room, EventType, type RoomMember, type MatrixClient } from "matrix-js-sdk/src/matrix";

import AliasCustomisations from "./customisations/Alias";
import { filterValidMDirect } from "./utils/dm/filterValidMDirect.ts";

/**
 * Given a room object, return the alias we should use for it,
 * if any. This could be the canonical alias if one exists, otherwise
 * an alias selected arbitrarily but deterministically from the list
 * of aliases. Otherwise return null;
 *
 * @param {Object} room The room object
 * @returns {string} A display alias for the given room
 */
export function getDisplayAliasForRoom(room: Room): string | null {
    return getDisplayAliasForAliasSet(room.getCanonicalAlias(), room.getAltAliases());
}

// The various display alias getters should all feed through this one path so
// there's a single place to change the logic.
export function getDisplayAliasForAliasSet(canonicalAlias: string | null, altAliases: string[]): string | null {
    if (AliasCustomisations.getDisplayAliasForAliasSet) {
        return AliasCustomisations.getDisplayAliasForAliasSet(canonicalAlias, altAliases);
    }
    return (canonicalAlias || altAliases?.[0]) ?? "";
}

export function guessAndSetDMRoom(room: Room, isDirect: boolean): Promise<void> {
    let newTarget;
    if (isDirect) {
        const guessedUserId = guessDMRoomTargetId(room, room.client.getSafeUserId());
        newTarget = guessedUserId;
    } else {
        newTarget = null;
    }

    return setDMRoom(room.client, room.roomId, newTarget);
}

/**
 * Marks or unmarks the given room as being as a DM room.
 * @param client the Matrix Client instance of the logged-in user
 * @param {string} roomId The ID of the room to modify
 * @param {string | null} userId The user ID of the desired DM room target user or
 *                        null to un-mark this room as a DM room
 * @returns {object} A promise
 */
export async function setDMRoom(client: MatrixClient, roomId: string, userId: string | null): Promise<void> {
    if (client.isGuest()) return;

    const mDirectEvent = client.getAccountData(EventType.Direct);
    const { filteredContent } = filterValidMDirect(mDirectEvent?.getContent() ?? {});

    // remove it from the lists of all users (it can only be a DM room for one person)
    for (const thisUserId in filteredContent) {
        if (!filteredContent[thisUserId]) continue;
        filteredContent[thisUserId] = filteredContent[thisUserId].filter((room) => room !== roomId);
    }

    // now add it if the caller asked for it to be a DM room
    if (userId) {
        if (!filteredContent[userId]) {
            filteredContent[userId] = [];
        }
        filteredContent[userId].push(roomId);
    }

    await client.setAccountData(EventType.Direct, filteredContent);
}

/**
 * Given a room, estimate which of its members is likely to
 * be the target if the room were a DM room and return that user.
 *
 * @param {Object} room Target room
 * @param {string} myUserId User ID of the current user
 * @returns {string} User ID of the user that the room is probably a DM with
 */
function guessDMRoomTargetId(room: Room, myUserId: string): string {
    let oldestTs: number | undefined;
    let oldestUser: RoomMember | undefined;

    // Pick the joined user who's been here longest (and isn't us),
    for (const user of room.getJoinedMembers()) {
        if (user.userId == myUserId) continue;

        if (oldestTs === undefined || (user.events.member && user.events.member.getTs() < oldestTs)) {
            oldestUser = user;
            oldestTs = user.events.member?.getTs();
        }
    }
    if (oldestUser) return oldestUser.userId;

    // if there are no joined members other than us, use the oldest member
    for (const user of room.currentState.getMembers()) {
        if (user.userId == myUserId) continue;

        if (oldestTs === undefined || (user.events.member && user.events.member.getTs() < oldestTs)) {
            oldestUser = user;
            oldestTs = user.events.member?.getTs();
        }
    }

    if (oldestUser === undefined) return myUserId;
    return oldestUser.userId;
}

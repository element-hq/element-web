/*
Copyright 2026 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { isMemberKey, type MatrixClient, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";

/**
 * Helpers for stable IDs (MSC4428).
 *
 * A room member is identified on the wire by a stable ID, and their user ID is an
 * attribute resolved through the room's `member_info` mapping. In an ordinary room the
 * two are the same string, so every function here is a no-op there; in a room with
 * member keys (MSC4430) the stable ID is the member's key and bears no relation to their
 * user ID.
 *
 * The rule of thumb: compare identities by *stable* ID, and show or link *user* IDs.
 * `Room.getMember()` accepts either, so most lookups need no help; these helpers are for
 * the comparisons and the places which have only a `MatrixEvent`.
 */

/**
 * Was this event sent by us?
 *
 * Replaces comparing `event.getSender()` with our own user ID, which does not hold in a
 * room with member keys: the sender is our key in that room.
 *
 * @param client - the client, used to find the room and our own identity.
 * @param event - the event to test.
 */
export function isEventSentByMe(client: MatrixClient, event: MatrixEvent): boolean {
    const room = client.getRoom(event.getRoomId());
    // Without the room we have no mapping, so the best we can do is the old comparison.
    // This is correct for every room which does not use member keys.
    if (!room) return event.getSender() === client.getUserId();
    return event.getStableId() === room.getMyStableId();
}

/**
 * Was this event sent by the given room member?
 *
 * @param room - the room the event is in.
 * @param event - the event to test.
 * @param id - the member's stable ID or user ID; either is accepted.
 */
export function isEventSentBy(room: Room, event: MatrixEvent, id: string): boolean {
    return event.getStableId() === room.resolveMemberIdentity(id).stableId;
}

/**
 * The user ID behind a room member's stable ID, for displaying, linking to a profile, or
 * passing to an API which takes a user ID.
 *
 * Delegates to the SDK, which resolves through the room's `member_info` mapping — into
 * which the server's signed `localpart`/`domain` claim from member events is also folded,
 * so this works for an invited room, whose stripped state carries no mapping.
 *
 * @returns the user ID, or `undefined` when the member cannot be named and the caller
 *     should show an unknown-user placeholder. Never returns a bare member key.
 */
export function memberUserId(room: Room, stableId: string): string | undefined {
    return room.getMemberUserId(stableId);
}

/**
 * The user ID of the member who sent this event.
 *
 * @see memberUserId
 */
export function senderUserId(client: MatrixClient, event: MatrixEvent): string | undefined {
    const stableId = event.getStableId();
    if (stableId === undefined) return undefined;

    const room = client.getRoom(event.getRoomId());
    if (!room) return isMemberKey(stableId) ? undefined : stableId;

    return memberUserId(room, stableId);
}

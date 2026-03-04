/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { JoinRule, type Room } from "matrix-js-sdk/src/matrix";

import { DefaultTagID, type TagID } from "../../stores/room-list-v3/skip-list/tag";
import { EffectiveMembership, getEffectiveMembership, getEffectiveMembershipTag } from "../membership";
import DMRoomMap from "../DMRoomMap";

/**
 * Get the tags for a room.
 * @param room - the room to get the tags for
 * @returns an array of tags for the room. If the room has no tags, it will return an array with the DefaultTagID.Untagged tag.
 */
export function getTagsForRoom(room: Room): TagID[] {
    const tags: TagID[] = [];

    if (!getEffectiveMembership(room.getMyMembership())) return [DefaultTagID.Untagged]; // peeked room has no tags

    const membership = getEffectiveMembershipTag(room);

    if (membership === EffectiveMembership.Invite) {
        tags.push(DefaultTagID.Invite);
    } else if (membership === EffectiveMembership.Leave) {
        tags.push(DefaultTagID.Archived);
    } else {
        tags.push(...getTagsOfJoinedRoom(room));
    }

    if (!tags.length) tags.push(DefaultTagID.Untagged);

    return tags || [DefaultTagID.Untagged];
}

/**
 * Get the tags for a room that the user has joined. It checks for user defined tags first, then checks if it's a DM, and finally checks if it's a conference room.
 * @param room
 * @returns
 */
function getTagsOfJoinedRoom(room: Room): TagID[] {
    let tags = Object.keys(room.tags || {});

    if (tags.length === 0) {
        // Check to see if it's a DM if it isn't anything else
        if (DMRoomMap.shared().getUserIdForRoomId(room.roomId)) {
            tags = [DefaultTagID.DM];
        }
    }
    if (room.isCallRoom() && (room.getJoinRule() === JoinRule.Public || room.getJoinRule() === JoinRule.Knock)) {
        tags.push(DefaultTagID.Conference);
    }

    return tags;
}

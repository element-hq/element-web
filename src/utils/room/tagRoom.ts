/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { JoinRule, type Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import RoomListActions from "../../actions/RoomListActions";
import dis from "../../dispatcher/dispatcher";
import DMRoomMap from "../DMRoomMap.ts";
import { EffectiveMembership, getEffectiveMembership, getEffectiveMembershipTag } from "../membership.ts";

export enum DefaultTagID {
    Invite = "im.vector.fake.invite",
    Untagged = "im.vector.fake.recent", // legacy: used to just be 'recent rooms' but now it's all untagged rooms
    Archived = "im.vector.fake.archived",
    LowPriority = "m.lowpriority",
    Favourite = "m.favourite",
    DM = "im.vector.fake.direct",
    Conference = "im.vector.fake.conferences",
    ServerNotice = "m.server_notice",
    Suggested = "im.vector.fake.suggested",
}

export type TagID = string | DefaultTagID;

export function getTagsForRoom(room: Room): TagID[] {
    const tags: TagID[] = [];

    if (!getEffectiveMembership(room.getMyMembership())) return []; // peeked room has no tags

    const membership = getEffectiveMembershipTag(room);

    if (membership === EffectiveMembership.Invite) {
        tags.push(DefaultTagID.Invite);
    } else if (membership === EffectiveMembership.Leave) {
        tags.push(DefaultTagID.Archived);
    } else {
        tags.push(...getTagsOfJoinedRoom(room));
    }

    if (!tags.length) tags.push(DefaultTagID.Untagged);

    return tags;
}

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

/**
 * Toggle tag for a given room
 * @param room The room to tag
 * @param tagId The tag to invert
 */
export function tagRoom(room: Room, tagId: TagID): void {
    if (tagId === DefaultTagID.Favourite || tagId === DefaultTagID.LowPriority) {
        const inverseTag = tagId === DefaultTagID.Favourite ? DefaultTagID.LowPriority : DefaultTagID.Favourite;
        const isApplied = getTagsForRoom(room).includes(tagId);
        const removeTag = isApplied ? tagId : inverseTag;
        const addTag = isApplied ? null : tagId;
        dis.dispatch(RoomListActions.tagRoom(room.client, room, removeTag, addTag));
    } else {
        logger.warn(`Unexpected tag ${tagId} applied to ${room.roomId}`);
    }
}

/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { DefaultTagID, type TagID } from "../../stores/room-list-v3/skip-list/tag";
import RoomListActions from "../../actions/RoomListActions";
import dis from "../../dispatcher/dispatcher";
import { getTagsForRoom } from "./getTagsForRoom";
import { isCustomSectionTag } from "../../stores/room-list-v3/section";
import RoomListStoreV3 from "../../stores/room-list-v3/RoomListStoreV3";

/**
 * Toggle tag for a given room.
 *
 * - For custom section tags: replaces the active space's current custom section tag (if any),
 *   leaving tags from other spaces intact. A room can be in one custom section per space.
 * - For Favourite/LowPriority: simple toggle of that specific tag, independent of custom sections.
 *
 * @param room The room to tag
 * @param tagId The tag to toggle
 */
export function tagRoom(room: Room, tagId: TagID): void {
    if (tagId !== DefaultTagID.Favourite && tagId !== DefaultTagID.LowPriority && !isCustomSectionTag(tagId)) {
        logger.warn(`Unexpected tag ${tagId} applied to ${room.roomId}`);
        return;
    }

    let removeTag: TagID | null;
    let addTag: TagID | null;

    if (isCustomSectionTag(tagId)) {
        // For custom sections: only replace within the active space's custom sections.
        // Tags from other spaces are left intact.
        const activeSpaceCustomSectionTags = new Set(
            RoomListStoreV3.instance.orderedSectionTags.filter((t) => isCustomSectionTag(t)),
        );
        const currentSectionTag = getTagsForRoom(room).find((t) => activeSpaceCustomSectionTags.has(t)) ?? null;
        const isApplied = currentSectionTag === tagId;
        removeTag = currentSectionTag;
        addTag = isApplied ? null : tagId;
    } else {
        // For Favourite/LowPriority: simple toggle — independent of custom sections.
        const isApplied = getTagsForRoom(room).includes(tagId);
        removeTag = isApplied ? tagId : null;
        addTag = isApplied ? null : tagId;
    }

    dis.dispatch(RoomListActions.tagRoom(room.client, room, removeTag, addTag));
}

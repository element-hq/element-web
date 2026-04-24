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

/**
 * Toggle tag for a given room.
 * A room can only be in one section: either a custom section, Favourite, or LowPriority.
 * Applying any of these will atomically replace the current section tag.
 * @param room The room to tag
 * @param tagId The tag to invert
 */
export function tagRoom(room: Room, tagId: TagID): void {
    if (tagId !== DefaultTagID.Favourite && tagId !== DefaultTagID.LowPriority && !isCustomSectionTag(tagId)) {
        logger.warn(`Unexpected tag ${tagId} applied to ${room.roomId}`);
        return;
    }

    // Find the section tag currently applied (Fav, LowPriority, or custom) — at most one exists
    const currentSectionTag =
        getTagsForRoom(room).find(
            (t) => t === DefaultTagID.Favourite || t === DefaultTagID.LowPriority || isCustomSectionTag(t),
        ) ?? null;

    const isApplied = currentSectionTag === tagId;
    const removeTag = currentSectionTag;
    const addTag = isApplied ? null : tagId;
    dis.dispatch(RoomListActions.tagRoom(room.client, room, removeTag, addTag));
}

/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import RoomListStore from "../../stores/room-list/RoomListStore";
import { DefaultTagID, type TagID } from "../../stores/room-list/models";
import RoomListActions from "../../actions/RoomListActions";
import dis from "../../dispatcher/dispatcher";

/**
 * Toggle tag for a given room
 * @param room The room to tag
 * @param tagId The tag to invert
 */
export function tagRoom(room: Room, tagId: TagID): void {
    if (tagId === DefaultTagID.Favourite || tagId === DefaultTagID.LowPriority) {
        const inverseTag = tagId === DefaultTagID.Favourite ? DefaultTagID.LowPriority : DefaultTagID.Favourite;
        const isApplied = RoomListStore.instance.getTagsForRoom(room).includes(tagId);
        const removeTag = isApplied ? tagId : inverseTag;
        const addTag = isApplied ? null : tagId;
        dis.dispatch(RoomListActions.tagRoom(room.client, room, removeTag, addTag, 0));
    } else {
        logger.warn(`Unexpected tag ${tagId} applied to ${room.roomId}`);
    }
}

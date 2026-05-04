/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";

import { DefaultTagID, type TagID } from "../../stores/room-list-v3/skip-list/tag";
import { getTagsForRoom } from "./getTagsForRoom";
import { isCustomSectionTag } from "../../stores/room-list-v3/section";

/**
 * Get the section tag for a given room.
 * @param room The room to get the section tag for.
 * @returns The section tag ID or null if none found.
 */
export function getSectionTagForRoom(room: Room): TagID | null {
    return (
        getTagsForRoom(room).find(
            (t) => t === DefaultTagID.Favourite || t === DefaultTagID.LowPriority || isCustomSectionTag(t),
        ) ?? null
    );
}

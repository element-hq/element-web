/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * Default tags that are used for rooms that don't have a user defined tag. These are used to determine where a room should be placed in the room list and how it should be sorted.
 */
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

/**
 * A tag ID is either a user defined tag (which is just a string) or one of the default tags defined in DefaultTagID.
 */
export type TagID = string | DefaultTagID;

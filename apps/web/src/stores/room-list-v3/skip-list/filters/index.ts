/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";

export const enum FilterEnum {
    FavouriteFilter = "favourite",
    UnreadFilter = "unread",
    PeopleFilter = "people",
    RoomsFilter = "rooms",
    LowPriorityFilter = "low_priority",
    MentionsFilter = "mentions",
    InvitesFilter = "invites",
}

export type FilterKey = FilterEnum | string;

export interface Filter {
    /**
     * Boolean return value indicates whether this room satisfies
     * the filter condition.
     */
    matches(room: Room): boolean;

    /**
     * Used to identify this particular filter.
     */
    key: FilterKey;
}

/**
 * A filter that picks the one key a room belongs to out of several, so the answer is
 * worked out once per room instead of once per key.
 */
export interface MultiKeyFilter {
    /** The key that applies to this room, or undefined when none does. */
    keyFor(room: Room): FilterKey | undefined;
}

/** Anything the skip list can apply to a room to work out its filter keys. */
export type AnyFilter = Filter | MultiKeyFilter;

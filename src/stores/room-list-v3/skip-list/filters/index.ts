/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";

export const enum Filters {
    FavouriteFilter,
}

export interface Filter {
    /**
     * Boolean return value indicates whether this room satisfies
     * the filter condition.
     */
    matches(room: Room): boolean;

    /**
     * An unique string used to identify a given filter.
     */
    key: Filters;
}

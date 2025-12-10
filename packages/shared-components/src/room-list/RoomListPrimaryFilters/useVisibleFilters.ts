/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useEffect, useState } from "react";

export interface Filter {
    /** Filter name/label */
    name: string;
    /** Whether the filter is currently active */
    active: boolean;
}

/**
 * A hook to sort the filters by active state.
 * The list is sorted if the current filter index is greater than or equal to the wrapping index.
 * If the wrapping index is -1, the filters are not sorted.
 *
 * @param filters - the list of filters to sort.
 * @param wrappingIndex - the index of the first filter that is wrapping.
 */
export function useVisibleFilters(filters: Filter[], wrappingIndex: number): Filter[] {
    // By default, the filters are not sorted
    const [sortedFilters, setSortedFilters] = useState(filters);

    useEffect(() => {
        const isActiveFilterWrapping = filters.findIndex((f) => f.active) >= wrappingIndex;
        // If the active filter is not wrapping, we don't need to sort the filters
        if (!isActiveFilterWrapping || wrappingIndex === -1) {
            setSortedFilters(filters);
            return;
        }

        // Sort the filters with the current filter at first position
        setSortedFilters(
            filters.slice().sort((filterA, filterB) => {
                // If the filter is active, it should be at the top of the list
                if (filterA.active && !filterB.active) return -1;
                if (!filterA.active && filterB.active) return 1;
                // If both filters are active or not, keep their original order
                return 0;
            }),
        );
    }, [filters, wrappingIndex]);

    return sortedFilters;
}

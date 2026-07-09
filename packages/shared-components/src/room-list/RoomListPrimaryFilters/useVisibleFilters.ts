/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useEffect, useState } from "react";

/**
 * Standard filter identifiers that can be used across implementations.
 * These are stable keys - the view layer maps them to translated labels.
 */
export type FilterId = "unread" | "people" | "rooms" | "favourite" | "mentions" | "invites" | "low_priority";

/**
 * A hook to sort the filter IDs by active state.
 * The list is sorted if the active filter index is greater than or equal to the wrapping index.
 * If the wrapping index is -1, the filters are not sorted.
 *
 * @param filterIds - the list of filter IDs to sort.
 * @param activeFilterId - the currently active filter ID (if any).
 * @param wrappingIndex - the index of the first filter that is wrapping.
 */
export function useVisibleFilters(
    filterIds: FilterId[],
    activeFilterId: FilterId | undefined,
    wrappingIndex: number,
): FilterId[] {
    // By default, the filters are not sorted
    const [sortedFilterIds, setSortedFilterIds] = useState(filterIds);

    useEffect(() => {
        const activeIndex = activeFilterId ? filterIds.indexOf(activeFilterId) : -1;
        const isActiveFilterWrapping = activeIndex >= wrappingIndex;
        // If the active filter is not wrapping, we don't need to sort the filters
        if (!isActiveFilterWrapping || wrappingIndex === -1) {
            setSortedFilterIds(filterIds);
            return;
        }

        // Sort the filters with the active filter at first position
        setSortedFilterIds(
            filterIds.slice().sort((filterA, filterB) => {
                // If the filter is active, it should be at the top of the list
                if (filterA === activeFilterId && filterB !== activeFilterId) return -1;
                if (filterA !== activeFilterId && filterB === activeFilterId) return 1;
                // If both filters are active or not, keep their original order
                return 0;
            }),
        );
    }, [filterIds, activeFilterId, wrappingIndex]);

    return sortedFilterIds;
}

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useEffect, useState } from "react";

import { type RoomListViewState } from "../../../components/viewmodels/roomlist/RoomListViewModel";

/**
 * A hook to sort the filters by active state.
 * The list is sorted if the current filter is not visible when the list is unexpanded.
 *
 * @param filters - the list of filters to sort.
 * @param isExpanded - the filter is expanded or not (fully visible).
 * @param isVisible - `null` if there is not selected filter. `true` or `false` if the filter is visible or not.
 */
export function useVisibleFilters(
    filters: RoomListViewState["primaryFilters"],
    isExpanded: boolean,
    isVisible: boolean | null,
): {
    /**
     * The new list of filters.
     */
    filters: RoomListViewState["primaryFilters"];
    /**
     * Reset the filter sorting when called.
     */
    onFilterChange: () => void;
} {
    // By default, the filters are not sorted
    const [filterState, setFilterState] = useState({ filters, isSorted: false });

    useEffect(() => {
        // If there is no current filter (isVisible is null)
        // or if the filter list is fully visible (isExpanded is true)
        // or if the current filter is visible and the list isn't sorted
        // then we don't need to sort the filters
        if (isVisible === null || isExpanded || (isVisible && !filterState.isSorted)) {
            setFilterState({ filters, isSorted: false });
            return;
        }

        // Sort the filters with the current filter at first position
        setFilterState({
            filters: filters.slice().sort((filterA, filterB) => {
                // If the filter is active, it should be at the top of the list
                if (filterA.active && !filterB.active) return -1;
                if (!filterA.active && filterB.active) return 1;
                // If both filters are active or not, keep their original order
                return 0;
            }),
            isSorted: true,
        });
    }, [filters, isVisible, filterState.isSorted, isExpanded]);

    const onFilterChange = (): void => {
        // Reset the filter sorting
        setFilterState({ filters, isSorted: false });
    };
    return { filters: filterState.filters, onFilterChange };
}

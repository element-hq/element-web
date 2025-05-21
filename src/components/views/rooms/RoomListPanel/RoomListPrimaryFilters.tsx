/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useEffect, useId, useState } from "react";
import { ChatFilter, IconButton } from "@vector-im/compound-web";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";

import type { RoomListViewState } from "../../../viewmodels/roomlist/RoomListViewModel";
import { Flex } from "../../../utils/Flex";
import { _t } from "../../../../languageHandler";
import { useIsNodeVisible } from "../../../../hooks/useIsNodeVisible";

interface RoomListPrimaryFiltersProps {
    /**
     * The view model for the room list
     */
    vm: RoomListViewState;
}

/**
 * The primary filters for the room list
 */
export function RoomListPrimaryFilters({ vm }: RoomListPrimaryFiltersProps): JSX.Element {
    const id = useId();
    const [isExpanded, setIsExpanded] = useState(false);

    // threshold: 0.5 means that the filter is considered visible if at least 50% of it is visible
    // this value is arbitrary, we want we to have a bit of flexibility
    const { isVisible, rootRef, nodeRef } = useIsNodeVisible<HTMLLIElement, HTMLUListElement>({ threshold: 0.5 });
    const { filters, onFilterChange } = useFilters(vm.primaryFilters, isExpanded, isVisible);

    return (
        <Flex id={id} className="mx_RoomListPrimaryFilters" gap="var(--cpd-space-3x)" data-expanded={isExpanded}>
            <Flex
                as="ul"
                role="listbox"
                aria-label={_t("room_list|primary_filters")}
                align="center"
                gap="var(--cpd-space-2x)"
                wrap="wrap"
                ref={rootRef}
            >
                {filters.map((filter) => (
                    <li
                        ref={filter.active ? nodeRef : undefined}
                        role="option"
                        aria-selected={filter.active}
                        key={filter.name}
                    >
                        <ChatFilter
                            selected={filter.active}
                            onClick={() => {
                                onFilterChange();
                                filter.toggle();
                            }}
                        >
                            {filter.name}
                        </ChatFilter>
                    </li>
                ))}
            </Flex>
            <IconButton
                aria-expanded={isExpanded}
                aria-controls={id}
                className="mx_RoomListPrimaryFilters_IconButton"
                aria-label={_t("room_list|room_options")}
                size="28px"
                onClick={() => setIsExpanded((_expanded) => !_expanded)}
            >
                <ChevronDownIcon color="var(--cpd-color-icon-secondary)" />
            </IconButton>
        </Flex>
    );
}

/**
 * A hook to sort the filters by active state.
 * The list is sorted if the current filter is not visible when the list is unexpanded.
 *
 * @param filters - the list of filters to sort.
 * @param isExpanded - the filter is expanded or not (fully visible).
 * @param isVisible - `null` if there is not selected filter. `true` or `false` if the filter is visible or not.
 */
function useFilters(
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
            filters: filters
                .slice()
                .sort((filterA, filterB) => (filterA.active === filterB.active ? 0 : filterA.active ? -1 : 1)),
            isSorted: true,
        });
    }, [filters, isVisible, filterState.isSorted, isExpanded]);

    const onFilterChange = (): void => {
        // Reset the filter sorting
        setFilterState({ filters, isSorted: false });
    };
    return { filters: filterState.filters, onFilterChange };
}

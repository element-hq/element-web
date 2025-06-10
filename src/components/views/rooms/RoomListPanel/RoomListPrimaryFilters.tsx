/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useEffect, useId, useRef, useState, type RefObject } from "react";
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

    const { filterHeight, filterRef } = useFilterHeight<HTMLButtonElement>();
    const { ref: containerRef, isExpanded: isSafeExpanded } = useAnimateFilter<HTMLDivElement>(
        isExpanded,
        filterHeight,
    );
    const { ref, isOverflowing: displayChevron } = useIsFilterOverflowing<HTMLUListElement>(filterHeight);

    return (
        <div className="mx_RoomListPrimaryFilters" data-testid="primary-filters">
            <div
                ref={containerRef}
                className="mx_RoomListPrimaryFilters_container"
                data-expanded={isSafeExpanded}
                data-testid="filter-container"
            >
                <Flex id={id} className="mx_RoomListPrimaryFilters_animated" gap="var(--cpd-space-3x)">
                    <Flex
                        as="ul"
                        role="listbox"
                        aria-label={_t("room_list|primary_filters")}
                        align="center"
                        gap="var(--cpd-space-2x)"
                        wrap="wrap"
                        ref={(node: HTMLUListElement) => {
                            rootRef(node);
                            // due to https://github.com/facebook/react/issues/29196
                            // eslint-disable-next-line react-compiler/react-compiler
                            ref.current = node;
                        }}
                    >
                        {filters.map((filter, i) => (
                            <li
                                ref={filter.active ? nodeRef : undefined}
                                role="option"
                                aria-selected={filter.active}
                                key={filter.name}
                            >
                                <ChatFilter
                                    ref={i === 0 ? filterRef : undefined}
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
                    {displayChevron && (
                        <IconButton
                            aria-expanded={isSafeExpanded}
                            aria-controls={id}
                            className="mx_RoomListPrimaryFilters_IconButton"
                            aria-label={
                                isSafeExpanded ? _t("room_list|collapse_filters") : _t("room_list|expand_filters")
                            }
                            size="28px"
                            onClick={() => setIsExpanded((_expanded) => !_expanded)}
                        >
                            <ChevronDownIcon color="var(--cpd-color-icon-secondary)" />
                        </IconButton>
                    )}
                </Flex>
            </div>
        </div>
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

/**
 * A hook to animate the filter list when it is expanded or not.
 * @param areFiltersExpanded
 * @param filterHeight
 */
function useAnimateFilter<T extends HTMLElement>(
    areFiltersExpanded: boolean,
    filterHeight: number,
): { ref: RefObject<T | null>; isExpanded: boolean } {
    const ref = useRef<T | null>(null);
    useEffect(() => {
        if (!ref.current) return;

        // Round to 2 decimal places and convert to integer to avoid floating point precision issues
        const floor = (a: number): number => Math.floor(a * 100) / 100 || 0;
        // For the animation to work, we need `grid-template-rows` to have the same unit at the beginning and the end
        // If px is used at the beginning, we need to use px at the end.
        // In our case, we use fr unit to fully grow when expanded (1fr) so we need to compute the value in fr when the filters are not expanded
        const setRowHeight = (): void =>
            ref.current?.style.setProperty("--row-height", `${floor(filterHeight / ref?.current.scrollHeight)}fr`);
        setRowHeight();

        const observer = new ResizeObserver(() => {
            // Remove transition to avoid the animation to run when the new --row-height is not set yet
            // If the animation runs at this moment, the first row will jump
            ref.current?.style.setProperty("transition", "unset");
            setRowHeight();
        });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [ref, filterHeight]);

    // Put back the transition to the element when the expanded state changes
    // because we want to animate it
    const [isExpanded, setExpanded] = useState(areFiltersExpanded);
    useEffect(() => {
        ref.current?.style.setProperty("transition", "0.1s ease-in-out");
        setExpanded(areFiltersExpanded);
    }, [areFiltersExpanded, ref]);

    return { ref, isExpanded };
}

/**
 * A hook to check if the filter list is overflowing.
 * The list is overflowing if the scrollHeight is greater than `FILTER_HEIGHT`.
 */
function useIsFilterOverflowing<T extends HTMLElement>(
    filterHeight: number,
): { ref: RefObject<T | undefined>; isOverflowing: boolean } {
    const ref = useRef<T>(undefined);
    const [isOverflowing, setIsOverflowing] = useState(false);

    useEffect(() => {
        if (!ref.current) return;

        const node = ref.current;
        const observer = new ResizeObserver(() => setIsOverflowing(node.scrollHeight > filterHeight));
        observer.observe(node);
        return () => observer.disconnect();
    }, [ref, filterHeight]);

    return { ref, isOverflowing };
}

/**
 * A hook to get the height of the filter list.
 * @returns a ref that should be put on the filter button and its height.
 */
function useFilterHeight<T extends HTMLElement>(): { filterHeight: number; filterRef: RefObject<T | null> } {
    const [filterHeight, setFilterHeight] = useState(0);
    const filterRef = useRef<T>(null);

    useEffect(() => {
        if (!filterRef.current) return;

        const setHeight = () => {
            const height = filterRef.current?.offsetHeight;
            if (height) setFilterHeight(height);
        };

        setHeight();
        const observer = new ResizeObserver(() => {
            setHeight();
        });
        observer.observe(filterRef.current);
        return () => observer.disconnect();
    }, [filterRef]);

    return { filterHeight, filterRef };
}

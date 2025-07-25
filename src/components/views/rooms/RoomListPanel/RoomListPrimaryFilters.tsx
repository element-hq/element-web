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
import { Flex } from "../../../../shared-components/utils/Flex";
import { _t } from "../../../../languageHandler";

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

    const { ref, isWrapping: displayChevron, wrappingIndex } = useCollapseFilters<HTMLUListElement>(isExpanded);
    const filters = useVisibleFilters(vm.primaryFilters, wrappingIndex);

    return (
        <Flex
            className="mx_RoomListPrimaryFilters"
            data-testid="primary-filters"
            gap="var(--cpd-space-3x)"
            direction="row-reverse"
        >
            {displayChevron && (
                <IconButton
                    kind="secondary"
                    aria-expanded={isExpanded}
                    aria-controls={id}
                    className="mx_RoomListPrimaryFilters_IconButton"
                    aria-label={isExpanded ? _t("room_list|collapse_filters") : _t("room_list|expand_filters")}
                    size="28px"
                    onClick={() => setIsExpanded((_expanded) => !_expanded)}
                >
                    <ChevronDownIcon />
                </IconButton>
            )}
            <Flex
                id={id}
                as="ul"
                role="listbox"
                aria-label={_t("room_list|primary_filters")}
                align="center"
                gap="var(--cpd-space-2x)"
                wrap="wrap"
                ref={ref}
            >
                {filters.map((filter, i) => (
                    <li role="option" aria-selected={filter.active} key={i}>
                        <ChatFilter selected={filter.active} onClick={() => filter.toggle()}>
                            {filter.name}
                        </ChatFilter>
                    </li>
                ))}
            </Flex>
        </Flex>
    );
}

/**
 * A hook to manage the wrapping of filters in the room list.
 * It observes the filter list and hides filters that are wrapping when the list is not expanded.
 * @param isExpanded
 * @returns an object containing:
 * - `ref`: a ref to put on the filter list element
 * - `isWrapping`: a boolean indicating if the filters are wrapping
 * - `wrappingIndex`: the index of the first filter that is wrapping
 */
function useCollapseFilters<T extends HTMLElement>(
    isExpanded: boolean,
): { ref: RefObject<T | null>; isWrapping: boolean; wrappingIndex: number } {
    const ref = useRef<T>(null);
    const [isWrapping, setIsWrapping] = useState(false);
    const [wrappingIndex, setWrappingIndex] = useState(-1);

    useEffect(() => {
        if (!ref.current) return;

        const hideFilters = (list: Element): void => {
            let isWrapping = false;
            Array.from(list.children).forEach((node, i): void => {
                const child = node as HTMLElement;
                const wrappingClass = "mx_RoomListPrimaryFilters_wrapping";
                child.setAttribute("aria-hidden", "false");
                child.classList.remove(wrappingClass);

                // If the filter list is expanded, all filters are visible
                if (isExpanded) return;

                // If the previous element is on the left element of the current one, it means that the filter is wrapping
                const previousSibling = child.previousElementSibling as HTMLElement | null;
                if (previousSibling && child.offsetLeft < previousSibling.offsetLeft) {
                    if (!isWrapping) setWrappingIndex(i);
                    isWrapping = true;
                }

                // If the filter is wrapping, we hide it
                child.classList.toggle(wrappingClass, isWrapping);
                child.setAttribute("aria-hidden", isWrapping.toString());
            });

            if (!isWrapping) setWrappingIndex(-1);
            setIsWrapping(isExpanded || isWrapping);
        };

        hideFilters(ref.current);
        const observer = new ResizeObserver((entries) => entries.forEach((entry) => hideFilters(entry.target)));

        observer.observe(ref.current);
        return () => {
            observer.disconnect();
        };
    }, [isExpanded]);

    return { ref, isWrapping, wrappingIndex };
}

/**
 * A hook to sort the filters by active state.
 * The list is sorted if the current filter index is greater than or equal to the wrapping index.
 * If the wrapping index is -1, the filters are not sorted.
 *
 * @param filters - the list of filters to sort.
 * @param wrappingIndex - the index of the first filter that is wrapping.
 */
export function useVisibleFilters(
    filters: RoomListViewState["primaryFilters"],
    wrappingIndex: number,
): RoomListViewState["primaryFilters"] {
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

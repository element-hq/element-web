/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useId, useState } from "react";
import { ChatFilter, IconButton } from "@vector-im/compound-web";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";

import type { RoomListViewState } from "../../../viewmodels/roomlist/RoomListViewModel";
import { Flex } from "../../../utils/Flex";
import { _t } from "../../../../languageHandler";
import { useIsNodeVisible } from "../../../../hooks/useIsNodeVisible";
import { useFilterHeight } from "../../../../hooks/left-panel/room-list/useFilterHeight";
import { useIsFilterOverflowing } from "../../../../hooks/left-panel/room-list/useIsFilterOverflowing";
import { useAnimateFilter } from "../../../../hooks/left-panel/room-list/useAnimateFilter";
import { useVisibleFilters } from "../../../../hooks/left-panel/room-list/useVisibleFilters";

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
    const { filters, onFilterChange } = useVisibleFilters(vm.primaryFilters, isExpanded, isVisible);

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

/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type CSSProperties, type JSX, memo, useEffect, useId, useRef, useState } from "react";
import { ChatFilter, IconButton } from "@vector-im/compound-web";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";

import { Flex } from "../../utils/Flex";
import { _t } from "../../utils/i18n";
import { useCollapseFilters } from "./useCollapseFilters";
import { useVisibleFilters, type FilterId } from "./useVisibleFilters";
import styles from "./RoomListPrimaryFilters.module.css";

const TRANSITION_DURATION_MS = 100;

/**
 * Maps filter IDs to translated labels
 */
const filterIdToLabel = (filterId: FilterId): string => {
    switch (filterId) {
        case "unread":
            return _t("room_list|filters|unread");
        case "people":
            return _t("room_list|filters|people");
        case "rooms":
            return _t("room_list|filters|rooms");
        case "favourite":
            return _t("room_list|filters|favourite");
        case "mentions":
            return _t("room_list|filters|mentions");
        case "invites":
            return _t("room_list|filters|invites");
        case "low_priority":
            return _t("room_list|filters|low_priority");
    }
};

/**
 * Props for RoomListPrimaryFilters component
 */
export interface RoomListPrimaryFiltersProps {
    /** Array of filter IDs to display */
    filterIds: FilterId[];
    /** Currently active filter ID (if any) */
    activeFilterId?: FilterId;
    /** Callback when a filter is toggled */
    onToggleFilter: (filterId: FilterId) => void;
}

/**
 * The primary filters component for the room list.
 * Displays a collapsible list of filters with expand/collapse functionality.
 */
export const RoomListPrimaryFilters = memo(function RoomListPrimaryFilters({
    filterIds,
    activeFilterId,
    onToggleFilter,
}: RoomListPrimaryFiltersProps): JSX.Element | null {
    const id = useId();
    const [isExpanded, setIsExpanded] = useState(false);
    const [collapsedHeight, setCollapsedHeight] = useState("40px");
    const [expandedHeight, setExpandedHeight] = useState("120px");
    const lastWrappingIndexRef = useRef<number | null>(null);

    const { ref, isWrapping: displayChevron, wrappingIndex } = useCollapseFilters<HTMLDivElement>(isExpanded);
    const visibleFilterIds = useVisibleFilters(filterIds, activeFilterId, wrappingIndex);

    useEffect(() => {
        const observer = new ResizeObserver(() =>
            setExpandedHeight(`calc(${ref.current!.scrollHeight}px + var(--cpd-space-5x))`),
        );
        observer.observe(ref.current!);
        return () => observer.disconnect();
    }, [ref]);

    if (wrappingIndex >= 0) {
        lastWrappingIndexRef.current = wrappingIndex;
    }

    const awayStartIndex = wrappingIndex >= 0 ? wrappingIndex : isExpanded ? lastWrappingIndexRef.current : null;
    const awayCount = awayStartIndex === null ? 0 : visibleFilterIds.length - awayStartIndex;

    return (
        <Flex
            className={styles.roomListPrimaryFilters}
            data-testid="primary-filters"
            style={{ height: isExpanded ? expandedHeight : collapsedHeight } as CSSProperties}
            gap="var(--cpd-space-3x)"
            direction="row-reverse"
            justify="space-between"
        >
            {displayChevron && (
                <IconButton
                    kind="secondary"
                    aria-expanded={isExpanded}
                    aria-controls={id}
                    className={styles.iconButton}
                    aria-label={isExpanded ? _t("room_list|collapse_filters") : _t("room_list|expand_filters")}
                    size="28px"
                    onClick={() => setIsExpanded((expanded) => !expanded)}
                >
                    <ChevronDownIcon />
                </IconButton>
            )}
            <Flex
                id={id}
                as="div"
                role="listbox"
                aria-label={_t("room_list|primary_filters")}
                align="center"
                gap="var(--cpd-space-2x)"
                wrap="wrap"
                className={styles.list}
                ref={ref}
            >
                {visibleFilterIds.map((filterId, index) => {
                    const hasAwayDelay = awayStartIndex !== null && index >= awayStartIndex;
                    const isAway = !isExpanded && hasAwayDelay;
                    const awayIndex = hasAwayDelay ? index - awayStartIndex : 0;
                    const filterStyle = hasAwayDelay
                        ? ({
                              "--away-delay": `${TRANSITION_DURATION_MS / 2 + (awayIndex * TRANSITION_DURATION_MS) / awayCount}ms`,
                          } as CSSProperties)
                        : undefined;

                    return (
                        <ChatFilter
                            key={`${filterId}-${index}`}
                            aria-hidden={isAway ? "true" : undefined}
                            inert={isAway ? true : undefined}
                            data-away={isAway ? "true" : undefined}
                            role="option"
                            selected={filterId === activeFilterId}
                            onClick={() => onToggleFilter(filterId)}
                            style={filterStyle}
                            ref={
                                index === 0 || index === visibleFilterIds.length - 1
                                    ? (node) => {
                                          if (node && index === 0) {
                                              setCollapsedHeight(`${Math.max(Math.ceil(node.getBoundingClientRect().height), 50)}px`);
                                          }
                                      }
                                    : undefined
                            }
                        >
                            {filterIdToLabel(filterId)}
                        </ChatFilter>
                    );
                })}
            </Flex>
        </Flex>
    );
});

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useId, useState } from "react";
import { ChatFilter, IconButton } from "@vector-im/compound-web";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";

import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../useViewModel";
import { Flex } from "../../utils/Flex";
import { _t } from "../../utils/i18n";
import { useCollapseFilters } from "./useCollapseFilters";
import { useVisibleFilters, type FilterViewModel } from "./useVisibleFilters";
import styles from "./RoomListPrimaryFilters.module.css";

/**
 * Snapshot for RoomListPrimaryFilters
 */
export type RoomListPrimaryFiltersSnapshot = {
    /** Array of filter data */
    filters: FilterViewModel[];
};

/**
 * Props for RoomListPrimaryFilters component
 */
export interface RoomListPrimaryFiltersProps {
    /** The view model containing filter data */
    vm: ViewModel<RoomListPrimaryFiltersSnapshot>;
}

/**
 * The primary filters component for the room list.
 * Displays a collapsible list of filters with expand/collapse functionality.
 */
export const RoomListPrimaryFilters: React.FC<RoomListPrimaryFiltersProps> = ({ vm }): JSX.Element => {
    const snapshot = useViewModel(vm);
    const id = useId();
    const [isExpanded, setIsExpanded] = useState(false);

    const { ref, isWrapping: displayChevron, wrappingIndex } = useCollapseFilters<HTMLUListElement>(isExpanded);
    const filters = useVisibleFilters(snapshot.filters, wrappingIndex);

    return (
        <Flex
            className={styles.roomListPrimaryFilters}
            data-testid="primary-filters"
            gap="var(--cpd-space-3x)"
            direction="row-reverse"
            justify="space-between"
        >
            {displayChevron && (
                <IconButton
                    kind="secondary"
                    aria-expanded={isExpanded}
                    aria-controls={id}
                    className="mx_RoomListPrimaryFilters_IconButton"
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
                {filters.map((filter, i) => (
                    <ChatFilter key={i} role="option" selected={filter.active} onClick={() => filter.toggle()}>
                        {filter.name}
                    </ChatFilter>
                ))}
            </Flex>
        </Flex>
    );
};

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { ChatFilter } from "@vector-im/compound-web";

import type { RoomListViewState } from "../../../viewmodels/roomlist/RoomListViewModel";
import { Flex } from "../../../utils/Flex";
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
    return (
        <Flex
            as="ul"
            role="listbox"
            aria-label={_t("room_list|primary_filters")}
            className="mx_RoomListPrimaryFilters"
            align="center"
            gap="var(--cpd-space-2x)"
            wrap="wrap"
        >
            {vm.primaryFilters.map((filter) => (
                <li role="option" aria-selected={filter.active} key={filter.name}>
                    <ChatFilter selected={filter.active} onClick={filter.toggle}>
                        {filter.name}
                    </ChatFilter>
                </li>
            ))}
        </Flex>
    );
}

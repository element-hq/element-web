/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { IconButton, Tooltip } from "@vector-im/compound-web";
import FilterIcon from "@vector-im/compound-design-tokens/assets/web/icons/filter";

import type { RoomListViewState } from "../../../viewmodels/roomlist/RoomListViewModel";
import { Flex } from "../../../utils/Flex";
import { _t } from "../../../../languageHandler";
import { SecondaryFilters } from "../../../viewmodels/roomlist/useFilteredRooms";
import { RoomListOptionsMenu } from "./RoomListOptionsMenu";

interface Props {
    /**
     * The view model for the room list
     */
    vm: RoomListViewState;
}

function textForFilter(filter: SecondaryFilters): string {
    switch (filter) {
        case SecondaryFilters.AllActivity:
            return _t("room_list|secondary_filter|all_activity");
        case SecondaryFilters.MentionsOnly:
            return _t("room_list|secondary_filter|mentions_only");
        case SecondaryFilters.InvitesOnly:
            return _t("room_list|secondary_filter|invites_only");
        case SecondaryFilters.LowPriority:
            return _t("room_list|secondary_filter|low_priority");
        default:
            throw new Error("Unknown filter");
    }
}

/**
 * The secondary filters for the room list (eg. mentions only / invites only).
 */
export function RoomListSecondaryFilters({ vm }: Props): JSX.Element {
    const activeFilterText = textForFilter(vm.activeSecondaryFilter);

    return (
        <Flex
            aria-label={_t("room_list|secondary_filters")}
            className="mx_RoomListSecondaryFilters"
            align="center"
            gap="8px"
        >
            {activeFilterText}
            <RoomListOptionsMenu vm={vm} />
        </Flex>
    );
}

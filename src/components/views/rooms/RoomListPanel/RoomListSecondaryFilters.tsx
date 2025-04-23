/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import type { RoomListViewState } from "../../../viewmodels/roomlist/RoomListViewModel";
import { Flex } from "../../../utils/Flex";
import { _t } from "../../../../languageHandler";
import { RoomListOptionsMenu } from "./RoomListOptionsMenu";

interface Props {
    /**
     * The view model for the room list
     */
    vm: RoomListViewState;
}

/**
 * The secondary filters for the room list (eg. mentions only / invites only).
 */
export function RoomListSecondaryFilters({ vm }: Props): JSX.Element {
    return (
        <Flex
            aria-label={_t("room_list|secondary_filters")}
            className="mx_RoomListSecondaryFilters"
            align="center"
            gap="8px"
        >
            <RoomListOptionsMenu vm={vm} />
        </Flex>
    );
}

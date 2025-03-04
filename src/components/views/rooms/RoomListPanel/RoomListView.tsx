/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { ChatFilter } from "@vector-im/compound-web";

import { type RoomListViewState, useRoomListViewModel } from "../../../viewmodels/roomlist/RoomListViewModel";
import { RoomList } from "./RoomList";
import { Flex } from "../../../utils/Flex";

export function RoomListView(): JSX.Element {
    const vm = useRoomListViewModel();
    // Room filters will be added soon
    return (
        <>
            <RoomFilters vm={vm} />
            <RoomList vm={vm} />;
        </>
    );
}

interface RoomFiltersProps {
    /**
     * The view model state for the room list.
     */
    vm: RoomListViewState;
}

function RoomFilters({ vm }: RoomFiltersProps): JSX.Element {
    return (
        <Flex className="mx_RoomFilters" align="center" gap="var(--cpd-space-2x)">
            <ChatFilter
                selected={vm.filter === "test"}
                onClick={() => vm.setFilter(vm.filter === "test" ? undefined : "test")}
            >
                With "Test"
            </ChatFilter>
            <ChatFilter
                selected={vm.filter === "without test"}
                onClick={() => vm.setFilter(vm.filter === "without test" ? undefined : "without test")}
            >
                Without "Test"
            </ChatFilter>
        </Flex>
    );
}

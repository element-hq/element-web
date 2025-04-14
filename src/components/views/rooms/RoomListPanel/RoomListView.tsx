/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import { useRoomListViewModel } from "../../../viewmodels/roomlist/RoomListViewModel";
import { RoomList } from "./RoomList";
import { EmptyRoomList } from "./EmptyRoomList";
import { RoomListPrimaryFilters } from "./RoomListPrimaryFilters";
import Spinner from "../../elements/Spinner";

/**
 * Host the room list and the (future) room filters
 */
export function RoomListView(): JSX.Element {
    const vm = useRoomListViewModel();
    const isRoomListEmpty = vm.rooms.length === 0;
    let listBody;
    if (vm.isLoadingRooms) {
        listBody = <Spinner />;
    } else if (isRoomListEmpty) {
        listBody = <EmptyRoomList vm={vm} />;
    } else {
        listBody = <RoomList vm={vm} />;
    }
    return (
        <>
            <RoomListPrimaryFilters vm={vm} />
            {listBody}
        </>
    );
}

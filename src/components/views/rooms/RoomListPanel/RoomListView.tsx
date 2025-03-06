/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import { useRoomListViewModel } from "../../../viewmodels/roomlist/RoomListViewModel";
import { RoomList } from "./RoomList";

/**
 * Host the room list and the (future) room filters
 */
export function RoomListView(): JSX.Element {
    const vm = useRoomListViewModel();
    // Room filters will be added soon
    return <RoomList vm={vm} />;
}

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useMemo } from "react";

import { RoomListSearchViewModel } from "../../../../viewmodels/room-list/RoomListSearchViewModel";
import { RoomListSearch as RoomListSearchView } from "../../../../shared-components/room-list/RoomListSearch";

/**
 * A search component to be displayed at the top of the room list
 * The `Explore` button is displayed only in the Home meta space and when UIComponent.ExploreRooms is enabled.
 */
export function RoomListSearch(): JSX.Element {
    const vm = useMemo(() => new RoomListSearchViewModel(), []);
    return <RoomListSearchView vm={vm} />;
}

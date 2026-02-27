/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useEffect, type JSX } from "react";
import { RoomListSearchView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { RoomListSearchViewModel } from "../../../../viewmodels/room-list/RoomListSearchViewModel";

type RoomListSearchProps = {
    /**
     * Current active space
     * The explore button is only displayed in the Home meta space
     */
    activeSpace: string;
};

/**
 * A search component to be displayed at the top of the room list
 * The `Explore` button is displayed only in the Home meta space and when UIComponent.ExploreRooms is enabled.
 */
export function RoomListSearch({ activeSpace }: RoomListSearchProps): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new RoomListSearchViewModel({ activeSpace }));
    useEffect(() => {
        vm.setActiveSpace(activeSpace);
    }, [activeSpace, vm]);

    return <RoomListSearchView vm={vm} />;
}

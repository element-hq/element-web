/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { shouldShowComponent } from "../../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../../settings/UIFeature";
import { RoomListSearch } from "./RoomListSearch";

type RoomListViewProps = {
    /**
     * Current active space
     * See {@link RoomListSearch}
     */
    activeSpace: string;
};

/**
 * A view component for the room list.
 */
export const RoomListView: React.FC<RoomListViewProps> = ({ activeSpace }) => {
    const displayRoomSearch = shouldShowComponent(UIComponent.FilterContainer);

    return (
        <div className="mx_RoomListView" data-testid="room-list-view">
            {displayRoomSearch && <RoomListSearch activeSpace={activeSpace} />}
        </div>
    );
};

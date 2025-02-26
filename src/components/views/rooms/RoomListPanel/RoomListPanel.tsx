/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { shouldShowComponent } from "../../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../../settings/UIFeature";
import { RoomListSearch } from "./RoomListSearch";
import { RoomListHeaderView } from "./RoomListHeaderView";
import { RoomListView } from "./RoomListView";
import { Flex } from "../../../utils/Flex";

type RoomListPanelProps = {
    /**
     * Current active space
     * See {@link RoomListSearch}
     */
    activeSpace: string;
};

/**
 * The panel of the room list
 */
export const RoomListPanel: React.FC<RoomListPanelProps> = ({ activeSpace }) => {
    const displayRoomSearch = shouldShowComponent(UIComponent.FilterContainer);

    return (
        <Flex
            as="section"
            className="mx_RoomListPanel"
            data-testid="room-list-panel"
            direction="column"
            align="stretch"
        >
            {displayRoomSearch && <RoomListSearch activeSpace={activeSpace} />}
            <RoomListHeaderView />
            <RoomListView />
        </Flex>
    );
};

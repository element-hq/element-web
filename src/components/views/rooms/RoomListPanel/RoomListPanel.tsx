/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { AutoSizer, List } from "react-virtualized";

import type { ListRowProps } from "react-virtualized";
import { shouldShowComponent } from "../../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../../settings/UIFeature";
import { RoomListSearch } from "./RoomListSearch";
import { RoomListHeaderView } from "./RoomListHeaderView";
import { useRoomListViewModel } from "../../../viewmodels/roomlist/RoomListViewModel";

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
    const { rooms } = useRoomListViewModel();

    const rowRenderer = ({ key, index, style }: ListRowProps): React.JSX.Element => {
        return (
            <div key={key} style={style}>
                {rooms[index].name}
            </div>
        );
    };

    return (
        <section className="mx_RoomListPanel" data-testid="room-list-panel">
            {displayRoomSearch && <RoomListSearch activeSpace={activeSpace} />}
            <RoomListHeaderView />
            <AutoSizer>
                {({ height, width }) => (
                    <List
                        rowRenderer={rowRenderer}
                        rowCount={rooms.length}
                        rowHeight={20}
                        height={height}
                        width={width}
                    />
                )}
            </AutoSizer>
        </section>
    );
};

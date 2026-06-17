/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";

import { useViewModel } from "../../core/viewmodel";
import { RoomListPrimaryFilters } from "../RoomListPrimaryFilters";
import { RoomListLoadingSkeleton } from "./RoomListLoadingSkeleton";
import { RoomListEmptyStateView } from "./RoomListEmptyStateView";
import { VirtualizedRoomListView } from "../VirtualizedRoomListView";
import { type Room } from "../VirtualizedRoomListView/RoomListItemWrapper/RoomListItemView";
import { RoomListToast } from "./RoomListToast";
import { type RoomListViewModel } from "./RoomListView.types";
import styles from "./RoomListView.module.css";
import { Flex } from "../../core/utils/Flex";
import { AutoHideScrollbar } from "../../core/utils/Scrollbar";

/**
 * Props for RoomListView component
 */
export interface RoomListViewProps {
    /** The view model containing all data and callbacks */
    vm: RoomListViewModel;
    /** Render function for room avatar */
    renderAvatar: (room: Room) => ReactNode;
    /** Optional callback for keyboard events on the room list */
    onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * Room list view component that manages filters, loading states, empty states, and the room list.
 */
export const RoomListView: React.FC<RoomListViewProps> = ({ vm, renderAvatar, onKeyDown }): JSX.Element => {
    const snapshot = useViewModel(vm);
    let listBody: ReactNode;

    if (snapshot.isLoadingRooms) {
        listBody = <RoomListLoadingSkeleton />;
    } else if (snapshot.isRoomListEmpty) {
        listBody = <RoomListEmptyStateView vm={vm} />;
    } else {
        listBody = <VirtualizedRoomListView vm={vm} renderAvatar={renderAvatar} onKeyDown={onKeyDown} />;
    }

    return (
        <>
            <div>
                <RoomListPrimaryFilters
                    filterIds={snapshot.filterIds}
                    activeFilterId={snapshot.activeFilterId}
                    onToggleFilter={vm.onToggleFilter}
                />
            </div>
            <Flex direction="column" className={styles.list}>
                <AutoHideScrollbar className={styles.scrollbar}>
                    {listBody}
                    {snapshot.toast && <RoomListToast type={snapshot.toast} onClose={vm.closeToast} />}
                </AutoHideScrollbar>
            </Flex>
        </>
    );
};

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";

import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../useViewModel";
import { RoomListPrimaryFilters, type RoomListPrimaryFiltersSnapshot } from "../RoomListPrimaryFilters";
import { RoomListLoadingSkeleton } from "./RoomListLoadingSkeleton";
import { RoomListEmptyState } from "./RoomListEmptyState";
import { RoomList, type RoomListSnapshot } from "../RoomList";
import { type RoomListItemViewModel } from "../RoomListItem";

/**
 * Snapshot for RoomListView
 */
export type RoomListViewSnapshot = {
    /** Whether the rooms are currently loading */
    isLoadingRooms: boolean;
    /** Whether the room list is empty */
    isRoomListEmpty: boolean;
    /** View model for the primary filters */
    filtersVm: ViewModel<RoomListPrimaryFiltersSnapshot>;
    /** View model for the room list */
    roomListVm: ViewModel<RoomListSnapshot>;
    /** Title for the empty state */
    emptyStateTitle: string;
    /** Optional description for the empty state */
    emptyStateDescription?: string;
    /** Optional action element for the empty state */
    emptyStateAction?: ReactNode;
};

/**
 * Props for RoomListView component
 */
export interface RoomListViewProps {
    /** The view model containing list data */
    vm: ViewModel<RoomListViewSnapshot>;
    /** Render function for room avatar */
    renderAvatar: (roomViewModel: RoomListItemViewModel) => ReactNode;
}

/**
 * The main room list view component.
 * Manages the display of filters, loading states, empty states, and the room list.
 */
export const RoomListView: React.FC<RoomListViewProps> = ({ vm, renderAvatar }): JSX.Element => {
    const snapshot = useViewModel(vm);
    let listBody: ReactNode;

    if (snapshot.isLoadingRooms) {
        listBody = <RoomListLoadingSkeleton />;
    } else if (snapshot.isRoomListEmpty) {
        listBody = (
            <RoomListEmptyState
                title={snapshot.emptyStateTitle}
                description={snapshot.emptyStateDescription}
                action={snapshot.emptyStateAction}
            />
        );
    } else {
        listBody = <RoomList vm={snapshot.roomListVm} renderAvatar={renderAvatar} />;
    }

    return (
        <>
            <RoomListPrimaryFilters vm={snapshot.filtersVm} />
            {listBody}
        </>
    );
};

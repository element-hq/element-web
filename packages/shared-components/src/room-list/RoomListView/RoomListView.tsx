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
import { RoomList, type RoomListViewModel } from "../RoomList";
import { type RoomListItem } from "../RoomListItem";

/**
 * Snapshot for RoomListView
 */
export type RoomListViewWrapperSnapshot = {
    /** Whether the rooms are currently loading */
    isLoadingRooms: boolean;
    /** Whether the room list is empty */
    isRoomListEmpty: boolean;
    /** View model for the primary filters */
    filtersVm: ViewModel<RoomListPrimaryFiltersSnapshot>;
    /** View model for the room list */
    roomListVm: RoomListViewModel;
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
    vm: ViewModel<RoomListViewWrapperSnapshot>;
    /** Render function for room avatar */
    renderAvatar: (roomItem: RoomListItem) => ReactNode;
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

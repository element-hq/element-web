/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";

import { RoomListPrimaryFilters, type RoomListPrimaryFiltersViewModel } from "../RoomListPrimaryFilters";
import { RoomListLoadingSkeleton } from "./RoomListLoadingSkeleton";
import { RoomListEmptyState } from "./RoomListEmptyState";
import { RoomList, type RoomListViewModel } from "../RoomList";
import { type RoomListItemViewModel } from "../RoomListItem";

/**
 * ViewModel interface for RoomListView
 */
export interface RoomListViewViewModel {
    /** Whether the rooms are currently loading */
    isLoadingRooms: boolean;
    /** Whether the room list is empty */
    isRoomListEmpty: boolean;
    /** View model for the primary filters */
    filtersViewModel: RoomListPrimaryFiltersViewModel;
    /** View model for the room list */
    roomListViewModel: RoomListViewModel;
    /** Title for the empty state */
    emptyStateTitle: string;
    /** Optional description for the empty state */
    emptyStateDescription?: string;
    /** Optional action element for the empty state */
    emptyStateAction?: ReactNode;
}

/**
 * Props for RoomListView component
 */
export interface RoomListViewProps {
    /** The view model containing list data */
    viewModel: RoomListViewViewModel;
    /** Render function for room avatar */
    renderAvatar: (roomViewModel: RoomListItemViewModel) => ReactNode;
}

/**
 * The main room list view component.
 * Manages the display of filters, loading states, empty states, and the room list.
 */
export const RoomListView: React.FC<RoomListViewProps> = ({ viewModel, renderAvatar }): JSX.Element => {
    let listBody: ReactNode;

    if (viewModel.isLoadingRooms) {
        listBody = <RoomListLoadingSkeleton />;
    } else if (viewModel.isRoomListEmpty) {
        listBody = (
            <RoomListEmptyState
                title={viewModel.emptyStateTitle}
                description={viewModel.emptyStateDescription}
                action={viewModel.emptyStateAction}
            />
        );
    } else {
        listBody = <RoomList viewModel={viewModel.roomListViewModel} renderAvatar={renderAvatar} />;
    }

    return (
        <>
            <RoomListPrimaryFilters viewModel={viewModel.filtersViewModel} />
            {listBody}
        </>
    );
};

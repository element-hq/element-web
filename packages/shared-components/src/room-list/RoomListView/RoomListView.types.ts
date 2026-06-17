/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type ReactNode } from "react";

import { type ViewModel } from "../../core/viewmodel";
import { type FilterId } from "../RoomListPrimaryFilters";
import { type ToastType } from "./RoomListToast";
import { type RoomListItemViewModel } from "../VirtualizedRoomListView/RoomListItemWrapper/RoomListItemView";
import { type RoomListSectionHeaderViewModel } from "../VirtualizedRoomListView/RoomListSectionHeaderView";

/**
 * Filter key type - opaque string type for filter identifiers
 */
export type FilterKey = string;

/**
 * State for the room list data (nested within {@link RoomListViewSnapshot}).
 *
 * Lives here rather than in `VirtualizedRoomListView` so that the view-model types can
 * reference it without creating an import cycle through the `RoomListView` barrel.
 */
export interface RoomListViewState {
    /** Optional active room index for keyboard navigation */
    activeRoomIndex?: number;
    /** Space ID for context tracking */
    spaceId?: string;
    /** Active filter keys for context tracking */
    filterKeys?: FilterKey[];
    /** Tag of a newly created section header to scroll into view */
    scrollToSectionTag?: string;
}

export type RoomListSection = {
    /** Unique identifier for the section */
    id: string;
    /** Array of room IDs that belong to this section */
    roomIds: string[];
};

/**
 * Snapshot for the room list view
 */
export type RoomListViewSnapshot = {
    /** Whether the rooms are currently loading */
    isLoadingRooms: boolean;
    /** Whether the room list is empty */
    isRoomListEmpty: boolean;
    /** Array of filter IDs */
    filterIds: FilterId[];
    /** Currently active filter ID (if any) */
    activeFilterId?: FilterId;
    /** Room list state */
    roomListState: RoomListViewState;
    /** Array of sections in the room list */
    sections: RoomListSection[];
    /** Optional description for the empty state */
    emptyStateDescription?: string;
    /** Optional action element for the empty state */
    emptyStateAction?: ReactNode;
    /** Whether the user can create rooms */
    canCreateRoom?: boolean;
    /** Whether the room list is displayed as a flat list */
    isFlatList: boolean;
    /** Optional toast to display */
    toast?: ToastType;
};

/**
 * Actions interface for room list operations
 */
export interface RoomListViewActions {
    /** Called when a filter is toggled */
    onToggleFilter: (filterId: FilterId) => void;
    /** Called to create a new chat room */
    createChatRoom: () => void;
    /** Called to create a new room */
    createRoom: () => void;
    /**
     * Get view model for a specific room (virtualization API)
     * Allow undefined to be returned if we don't have a view model for the room. In this case the room will not be rendered.
     */
    getRoomItemViewModel: (roomId: string) => RoomListItemViewModel | undefined;
    /** Called when the visible range changes (virtualization API) */
    updateVisibleRooms: (startIndex: number, endIndex: number) => void;
    /** Get view model for a specific section header (virtualization API) */
    getSectionHeaderViewModel: (sectionId: string) => RoomListSectionHeaderViewModel;
    /** Called to close the toast message */
    closeToast: () => void;
    /** Called to change the section of a room */
    changeRoomSection: (roomId: string, tag: string) => void;
    /** Called to change the order of sections */
    changeSectionOrder: (sourceTag: string, targetTag: string) => void;
    /** Called when a section drag starts — collapses all sections */
    onSectionDragStart: () => void;
    /** Called when a section drag ends (drop or cancel) — restores expansion states */
    onSectionDragEnd: () => void;
}

/**
 * The view model type for the room list view
 */
export type RoomListViewModel = ViewModel<RoomListViewSnapshot, RoomListViewActions>;

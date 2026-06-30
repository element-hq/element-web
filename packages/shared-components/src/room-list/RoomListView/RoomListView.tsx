/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";

import { useViewModel, type ViewModel } from "../../core/viewmodel";
import { RoomListPrimaryFilters, type FilterId } from "../RoomListPrimaryFilters";
import { RoomListLoadingSkeleton } from "./RoomListLoadingSkeleton";
import { RoomListEmptyStateView } from "./RoomListEmptyStateView";
import { VirtualizedRoomListView, type RoomListViewState } from "../VirtualizedRoomListView";
import { type Room, type RoomListItemViewModel } from "../VirtualizedRoomListView/RoomListItemWrapper/RoomListItemView";
import { type RoomListSectionHeaderViewModel } from "../VirtualizedRoomListView/RoomListSectionHeaderView";
import { type ToastType, RoomListToast } from "./RoomListToast";
import styles from "./RoomListView.module.css";
import { Flex } from "../../core/utils/Flex";
import { AutoHideScrollbar } from "../../core/utils/Scrollbar";

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
    /**
     * The single toast to display (if any). The view model owns which toast wins when more
     * than one applies (e.g. a transient "chat_moved" event toast takes precedence over the
     * persistent "unread_activity" toast), so the view just renders whatever it is given.
     */
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
    /**
     * Called when the last genuinely-visible item index changes (excluding the rendered
     * overscan buffer), used to decide whether unread activity is below the fold.
     */
    updateVisibleFold: (visibleEndIndex: number) => void;
    /** Get view model for a specific section header (virtualization API) */
    getSectionHeaderViewModel: (sectionId: string) => RoomListSectionHeaderViewModel;
    /** Called to close the toast message */
    closeToast: () => void;
    /** Called to scroll the next unread room below the visible area of the list into view */
    scrollToUnreadActivity: () => void;
    /**
     * Registers (or, with `undefined`, clears) the imperative scroll handler the view model
     * uses to scroll a virtualized item index into view. The view owns the scroll handle, so
     * it provides this on mount; the view model calls it in response to user actions such as
     * clicking the "unread activity" toast.
     */
    setScrollToIndex: (scrollToIndex: ((index: number) => void) | undefined) => void;
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
                    {snapshot.toast && (
                        <RoomListToast
                            type={snapshot.toast}
                            onClose={vm.closeToast}
                            onClick={vm.scrollToUnreadActivity}
                        />
                    )}
                </AutoHideScrollbar>
            </Flex>
        </>
    );
};

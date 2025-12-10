/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";

import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../useViewModel";
import { _t } from "../../utils/i18n";
import { RoomListPrimaryFilters, type Filter } from "../RoomListPrimaryFilters";
import { RoomListLoadingSkeleton } from "./RoomListLoadingSkeleton";
import { RoomListEmptyState } from "./RoomListEmptyState";
import { RoomList, type RoomListViewState } from "../RoomList";
import { type RoomListItem } from "../RoomListItem";
import { type RoomNotifState } from "../../notifications/RoomNotifs";
import { type RoomListHeaderState } from "../RoomListHeader";
import { SortOption } from "../RoomListHeader/SortOptionsMenu";

/**
 * Snapshot for the complete room list, used across RoomListPanel, RoomListView, and RoomList
 * Contains all data AND all callbacks needed by the room list components
 */
export type RoomListSnapshot = {
    /** Header state for the room list */
    headerState: RoomListHeaderState;
    /** Whether the rooms are currently loading */
    isLoadingRooms: boolean;
    /** Whether the room list is empty */
    isRoomListEmpty: boolean;
    /** Array of filter data (required by RoomListPrimaryFilters) */
    filters: Filter[];
    /** Room list state */
    roomListState: RoomListViewState;
    /** Optional description for the empty state */
    emptyStateDescription?: string;
    /** Optional action element for the empty state */
    emptyStateAction?: ReactNode;
};

/**
 * Actions interface for room list operations
 */
export interface RoomListViewActions {
    /** Whether to show the dial pad button */
    showDialPad: boolean;
    /** Whether to show the explore rooms button */
    showExplore: boolean;
    /** Called when a filter is toggled */
    onToggleFilter: (filter: Filter) => void;
    /** Called when search button is clicked */
    onSearchClick: () => void;
    /** Called when dial pad button is clicked */
    onDialPadClick: () => void;
    /** Called when explore button is clicked */
    onExploreClick: () => void;
    /** Called when compose button is clicked */
    onComposeClick: () => void;
    /** Open the space home */
    openSpaceHome: () => void;
    /** Display the space invite dialog */
    inviteInSpace: () => void;
    /** Open the space preferences */
    openSpacePreferences: () => void;
    /** Open the space settings */
    openSpaceSettings: () => void;
    /** Create a chat room */
    createChatRoom: () => void;
    /** Create a room */
    createRoom: () => void;
    /** Create a video room */
    createVideoRoom: () => void;
    /** Change the sort order of the room-list */
    sort: (option: SortOption) => void;
    /** Called when a room should be opened */
    onOpenRoom: (roomId: string) => void;
    /** Called when a room should be marked as read */
    onMarkAsRead: (roomId: string) => void;
    /** Called when a room should be marked as unread */
    onMarkAsUnread: (roomId: string) => void;
    /** Called when a room's favorite status should be toggled */
    onToggleFavorite: (roomId: string) => void;
    /** Called when a room's low priority status should be toggled */
    onToggleLowPriority: (roomId: string) => void;
    /** Called when inviting users to a room */
    onInvite: (roomId: string) => void;
    /** Called when copying a room link */
    onCopyRoomLink: (roomId: string) => void;
    /** Called when leaving a room */
    onLeaveRoom: (roomId: string) => void;
    /** Called when setting room notification state */
    onSetRoomNotifState: (roomId: string, notifState: RoomNotifState) => void;
}

/**
 * The view model type for the room list
 */
export type RoomListViewModel = ViewModel<RoomListSnapshot> & RoomListViewActions;

/**
 * Props for RoomListView component
 */
export interface RoomListViewProps {
    /** The view model containing all data and callbacks */
    vm: RoomListViewModel;
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
                title={_t("room_list|empty_no_rooms")}
                description={snapshot.emptyStateDescription}
                action={snapshot.emptyStateAction}
            />
        );
    } else {
        listBody = <RoomList vm={vm} renderAvatar={renderAvatar} />;
    }

    return (
        <>
            <RoomListPrimaryFilters filters={snapshot.filters} onToggleFilter={vm.onToggleFilter} />
            {listBody}
        </>
    );
};

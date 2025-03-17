/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import { type PrimaryFilter, type SecondaryFilters, useFilteredRooms } from "./useFilteredRooms";
import { type SortOption, useSorter } from "./useSorter";
import { useMessagePreviewToggle } from "./useMessagePreviewToggle";

export interface RoomListViewState {
    /**
     * A list of rooms to be displayed in the left panel.
     */
    rooms: Room[];
    /**
     * A list of objects that provide the view enough information
     * to render primary room filters.
     */
    primaryFilters: PrimaryFilter[];

    /**
     * A function to activate a given secondary filter.
     */
    activateSecondaryFilter: (filter: SecondaryFilters) => void;

    /**
     * The currently active secondary filter.
     */
    activeSecondaryFilter: SecondaryFilters;

    /**
     * Change the sort order of the room-list.
     */
    sort: (option: SortOption) => void;

    /**
     * The currently active sort option.
     */
    activeSortOption: SortOption;

    /**
     * Whether message previews must be shown or not.
     */
    shouldShowMessagePreview: boolean;

    /**
     * A function to turn on/off message previews.
     */
    toggleMessagePreview: () => void;
}

/**
 * View model for the new room list
 * @see {@link RoomListViewState} for more information about what this view model returns.
 */
export function useRoomListViewModel(): RoomListViewState {
    const { primaryFilters, rooms, activateSecondaryFilter, activeSecondaryFilter } = useFilteredRooms();
    const { activeSortOption, sort } = useSorter();
    const { shouldShowMessagePreview, toggleMessagePreview } = useMessagePreviewToggle();

    return {
        rooms,
        primaryFilters,
        activateSecondaryFilter,
        activeSecondaryFilter,
        activeSortOption,
        sort,
        shouldShowMessagePreview,
        toggleMessagePreview,
    };
}

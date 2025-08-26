/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useEffect, useMemo, useState } from "react";

import { FilterKey } from "../../../stores/room-list-v3/skip-list/filters";
import { _t, _td, type TranslationKey } from "../../../languageHandler";
import RoomListStoreV3, {
    LISTS_LOADED_EVENT,
    LISTS_UPDATE_EVENT,
    type RoomsResult,
} from "../../../stores/room-list-v3/RoomListStoreV3";
import { useEventEmitter } from "../../../hooks/useEventEmitter";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import { UPDATE_SELECTED_SPACE } from "../../../stores/spaces";

/**
 * Provides information about a primary filter.
 * A primary filter is a commonly used filter that is given
 * more precedence in the UI. For eg, primary filters may be
 * rendered as pills above the room list.
 */
export interface PrimaryFilter {
    // A function to toggle this filter on and off.
    toggle: () => void;
    // Whether this filter is currently applied
    active: boolean;
    // Text that can be used in the UI to represent this filter.
    name: string;
    // The key of the filter
    key: FilterKey;
}

interface FilteredRooms {
    primaryFilters: PrimaryFilter[];
    isLoadingRooms: boolean;
    roomsResult: RoomsResult;
    /**
     * The currently active primary filter.
     * If no primary filter is active, this will be undefined.
     */
    activePrimaryFilter?: PrimaryFilter;
}

const filterKeyToNameMap: Map<FilterKey, TranslationKey> = new Map([
    [FilterKey.UnreadFilter, _td("room_list|filters|unread")],
    [FilterKey.PeopleFilter, _td("room_list|filters|people")],
    [FilterKey.RoomsFilter, _td("room_list|filters|rooms")],
    [FilterKey.MentionsFilter, _td("room_list|filters|mentions")],
    [FilterKey.InvitesFilter, _td("room_list|filters|invites")],
    [FilterKey.FavouriteFilter, _td("room_list|filters|favourite")],
    [FilterKey.LowPriorityFilter, _td("room_list|filters|low_priority")],
]);

/**
 * Track available filters and provide a filtered list of rooms.
 */
export function useFilteredRooms(): FilteredRooms {
    /**
     * Primary filter refers to the pill based filters
     * rendered above the room list.
     */
    const [primaryFilter, setPrimaryFilter] = useState<FilterKey | undefined>();

    const [roomsResult, setRoomsResult] = useState(() => RoomListStoreV3.instance.getSortedRoomsInActiveSpace());
    const [isLoadingRooms, setIsLoadingRooms] = useState(() => RoomListStoreV3.instance.isLoadingRooms);

    const updateRoomsFromStore = useCallback((filters: FilterKey[] = []): void => {
        const newRooms = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(filters);
        setRoomsResult(newRooms);
    }, []);

    // Reset filters when active space changes
    useEventEmitter(SpaceStore.instance, UPDATE_SELECTED_SPACE, () => setPrimaryFilter(undefined));

    const filterUndefined = (array: (FilterKey | undefined)[]): FilterKey[] =>
        array.filter((f) => f !== undefined) as FilterKey[];

    const getAppliedFilters = useCallback((): FilterKey[] => {
        return filterUndefined([primaryFilter]);
    }, [primaryFilter]);

    useEffect(() => {
        // Update the rooms state when the primary filter changes
        const filters = getAppliedFilters();
        updateRoomsFromStore(filters);
    }, [getAppliedFilters, updateRoomsFromStore]);

    useEventEmitter(RoomListStoreV3.instance, LISTS_UPDATE_EVENT, () => {
        const filters = getAppliedFilters();
        updateRoomsFromStore(filters);
    });

    useEventEmitter(RoomListStoreV3.instance, LISTS_LOADED_EVENT, () => {
        setIsLoadingRooms(false);
    });

    /**
     * This tells the view which primary filters are available, how to toggle them
     * and whether a given primary filter is active. @see {@link PrimaryFilter}
     */
    const primaryFilters = useMemo(() => {
        const createPrimaryFilter = (key: FilterKey, name: string): PrimaryFilter => {
            return {
                toggle: () => {
                    setPrimaryFilter((currentFilter) => {
                        const filter = currentFilter === key ? undefined : key;
                        updateRoomsFromStore(filterUndefined([filter]));
                        return filter;
                    });
                },
                active: primaryFilter === key,
                name,
                key,
            };
        };
        const filters: PrimaryFilter[] = [];
        for (const [key, name] of filterKeyToNameMap.entries()) {
            filters.push(createPrimaryFilter(key, _t(name)));
        }
        return filters;
    }, [primaryFilter, updateRoomsFromStore]);

    const activePrimaryFilter = useMemo(() => primaryFilters.find((filter) => filter.active), [primaryFilters]);

    return {
        isLoadingRooms,
        primaryFilters,
        activePrimaryFilter,
        roomsResult,
    };
}

/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useMemo, useState } from "react";

import type { Room } from "matrix-js-sdk/src/matrix";
import { FilterKey } from "../../../stores/room-list-v3/skip-list/filters";
import { _t, _td, type TranslationKey } from "../../../languageHandler";
import RoomListStoreV3 from "../../../stores/room-list-v3/RoomListStoreV3";
import { LISTS_UPDATE_EVENT } from "../../../stores/room-list/RoomListStore";
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
    rooms: Room[];
    activateSecondaryFilter: (filter: SecondaryFilters) => void;
    activeSecondaryFilter: SecondaryFilters;
    /**
     * The currently active primary filter.
     * If no primary filter is active, this will be undefined.
     */
    activePrimaryFilter?: PrimaryFilter;
}

const filterKeyToNameMap: Map<FilterKey, TranslationKey> = new Map([
    [FilterKey.UnreadFilter, _td("room_list|filters|unread")],
    [FilterKey.FavouriteFilter, _td("room_list|filters|favourite")],
    [FilterKey.PeopleFilter, _td("room_list|filters|people")],
    [FilterKey.RoomsFilter, _td("room_list|filters|rooms")],
]);

/**
 * These are the secondary filters which are not prominently shown
 * in the UI.
 */
export const enum SecondaryFilters {
    AllActivity,
    MentionsOnly,
    InvitesOnly,
    LowPriority,
}

/**
 * A map from {@link SecondaryFilters} which the UI understands to
 * {@link FilterKey} which the store understands.
 */
const secondaryFiltersToFilterKeyMap = new Map([
    [SecondaryFilters.AllActivity, undefined],
    [SecondaryFilters.MentionsOnly, FilterKey.MentionsFilter],
    [SecondaryFilters.InvitesOnly, FilterKey.InvitesFilter],
    [SecondaryFilters.LowPriority, FilterKey.LowPriorityFilter],
]);

/**
 * Use this function to determine if a given primary filter is compatible with
 * a given secondary filter. Practically, this determines whether it makes sense
 * to expose two filters together in the UI - for eg, it does not make sense to show the
 * favourite primary filter if the active secondary filter is low priority.
 * @param primary Primary filter key
 * @param secondary Secondary filter key
 * @returns true if compatible, false otherwise
 */
function isPrimaryFilterCompatible(primary: FilterKey, secondary: FilterKey): boolean {
    if (secondary === FilterKey.MentionsFilter) {
        if (primary === FilterKey.UnreadFilter) return false;
    } else if (secondary === FilterKey.InvitesFilter) {
        if (primary === FilterKey.UnreadFilter || primary === FilterKey.FavouriteFilter) return false;
    } else if (secondary === FilterKey.LowPriorityFilter) {
        if (primary === FilterKey.FavouriteFilter) return false;
    }
    return true;
}

/**
 * Track available filters and provide a filtered list of rooms.
 */
export function useFilteredRooms(): FilteredRooms {
    /**
     * Primary filter refers to the pill based filters
     * rendered above the room list.
     */
    const [primaryFilter, setPrimaryFilter] = useState<FilterKey | undefined>();
    /**
     * Secondary filters are also filters but they are hidden
     * away in a popup menu.
     */
    const [activeSecondaryFilter, setActiveSecondaryFilter] = useState<SecondaryFilters>(SecondaryFilters.AllActivity);

    const secondaryFilter = useMemo(
        () => secondaryFiltersToFilterKeyMap.get(activeSecondaryFilter),
        [activeSecondaryFilter],
    );

    const [rooms, setRooms] = useState(() => RoomListStoreV3.instance.getSortedRoomsInActiveSpace());

    const updateRoomsFromStore = useCallback((filters: FilterKey[] = []): void => {
        const newRooms = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(filters);
        setRooms(newRooms);
    }, []);

    // Reset filters when active space changes
    useEventEmitter(SpaceStore.instance, UPDATE_SELECTED_SPACE, () => {
        setPrimaryFilter(undefined);
        activateSecondaryFilter(SecondaryFilters.AllActivity);
    });

    const filterUndefined = (array: (FilterKey | undefined)[]): FilterKey[] =>
        array.filter((f) => f !== undefined) as FilterKey[];

    const getAppliedFilters = (): FilterKey[] => {
        return filterUndefined([primaryFilter, secondaryFilter]);
    };

    useEventEmitter(RoomListStoreV3.instance, LISTS_UPDATE_EVENT, () => {
        const filters = getAppliedFilters();
        updateRoomsFromStore(filters);
    });

    /**
     * Secondary filters are activated using this function.
     * This is different to how primary filters work because the secondary
     * filters are static i.e they are always available and don't need to be
     * hidden.
     */
    const activateSecondaryFilter = useCallback(
        (filter: SecondaryFilters): void => {
            // If the filter is already active, just return.
            if (filter === activeSecondaryFilter) return;

            // SecondaryFilter is an enum for the UI, let's convert it to something
            // that the store will understand.
            const secondary = secondaryFiltersToFilterKeyMap.get(filter);
            setActiveSecondaryFilter(filter);

            // Reset any active primary filters.
            setPrimaryFilter(undefined);

            updateRoomsFromStore(filterUndefined([secondary]));
        },
        [activeSecondaryFilter, updateRoomsFromStore],
    );

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
                        updateRoomsFromStore(filterUndefined([filter, secondaryFilter]));
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
            if (secondaryFilter && !isPrimaryFilterCompatible(key, secondaryFilter)) {
                continue;
            }
            filters.push(createPrimaryFilter(key, _t(name)));
        }
        return filters;
    }, [primaryFilter, updateRoomsFromStore, secondaryFilter]);

    const activePrimaryFilter = useMemo(() => primaryFilters.find((filter) => filter.active), [primaryFilters]);

    return { primaryFilters, activePrimaryFilter, rooms, activateSecondaryFilter, activeSecondaryFilter };
}

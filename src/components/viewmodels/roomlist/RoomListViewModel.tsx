/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useMemo, useState } from "react";

import type { Room } from "matrix-js-sdk/src/matrix";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import type { TranslationKey } from "../../../languageHandler";
import RoomListStoreV3 from "../../../stores/room-list-v3/RoomListStoreV3";
import { useEventEmitter } from "../../../hooks/useEventEmitter";
import { LISTS_UPDATE_EVENT } from "../../../stores/room-list/RoomListStore";
import dispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { FilterKey } from "../../../stores/room-list-v3/skip-list/filters";
import { _t } from "../../../languageHandler";

export interface RoomListViewState {
    /**
     * A list of rooms to be displayed in the left panel.
     */
    rooms: Room[];

    /**
     * Open the room having given roomId.
     */
    openRoom: (roomId: string) => void;

    /**
     * A list of objects that provide the view enough information
     * to render primary room filters.
     */
    primaryFilters: PrimaryFilter[];
}

/**
 * View model for the new room list
 * @see {@link RoomListViewState} for more information about what this view model returns.
 */
export function useRoomListViewModel(): RoomListViewState {
    const { primaryFilters, rooms } = useFilteredRooms();

    const openRoom = useCallback((roomId: string): void => {
        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: roomId,
            metricsTrigger: "RoomList",
        });
    }, []);

    return {
        rooms,
        openRoom,
        primaryFilters,
    };
}

interface PrimaryFilter {
    // A function to toggle this filter on and off.
    toggle: () => void;
    // Whether this filter is currently applied
    active: boolean;
    // Text that can be used in the UI to represent this filter.
    name: string;
}

interface FilteredRooms {
    primaryFilters: PrimaryFilter[];
    rooms: Room[];
}

const filterKeyToNameMap: Map<FilterKey, TranslationKey> = new Map([
    [FilterKey.UnreadFilter, "room_list|filters|unread"],
    [FilterKey.FavouriteFilter, "room_list|filters|favourite"],
    [FilterKey.PeopleFilter, "room_list|filters|people"],
    [FilterKey.RoomsFilter, "room_list|filters|rooms"],
]);

/**
 * Track available filters and provide a filtered list of rooms.
 */
function useFilteredRooms(): FilteredRooms {
    const [primaryFilter, setPrimaryFilter] = useState<FilterKey | undefined>();
    const [rooms, setRooms] = useState(() => RoomListStoreV3.instance.getSortedRoomsInActiveSpace());

    const updateRoomsFromStore = useCallback((filter?: FilterKey): void => {
        const filters = filter !== undefined ? [filter] : [];
        const newRooms = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(filters);
        setRooms(newRooms);
    }, []);

    useEventEmitter(RoomListStoreV3.instance, LISTS_UPDATE_EVENT, () => {
        updateRoomsFromStore(primaryFilter);
    });

    const primaryFilters = useMemo(() => {
        const createPrimaryFilter = (key: FilterKey, name: string): PrimaryFilter => {
            return {
                toggle: () => {
                    setPrimaryFilter((currentFilter) => {
                        const filter = currentFilter === key ? undefined : key;
                        updateRoomsFromStore(filter);
                        return filter;
                    });
                },
                active: primaryFilter === key,
                name,
            };
        };
        const filters: PrimaryFilter[] = [];
        for (const [key, name] of filterKeyToNameMap.entries()) {
            filters.push(createPrimaryFilter(key, _t(name)));
        }
        return filters;
    }, [primaryFilter, updateRoomsFromStore]);

    return { primaryFilters, rooms };
}

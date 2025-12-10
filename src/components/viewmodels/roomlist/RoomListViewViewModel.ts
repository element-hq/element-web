/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BaseViewModel, type RoomListViewWrapperSnapshot } from "@element-hq/web-shared-components";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";

import RoomListStoreV3, { RoomListStoreV3Event } from "../../../stores/room-list-v3/RoomListStoreV3";
import { RoomListPrimaryFiltersViewModel } from "./RoomListPrimaryFiltersViewModel";
import { RoomListViewModel } from "./RoomListViewModel";
import { FilterKey } from "../../../stores/room-list-v3/skip-list/filters";
import { _t } from "../../../languageHandler";

interface RoomListViewViewModelProps {
    client: MatrixClient;
}

/**
 * ViewModel for the RoomListView wrapper.
 * Manages filters, loading state, empty state, and the room list.
 */
export class RoomListViewViewModel extends BaseViewModel<
    RoomListViewWrapperSnapshot,
    RoomListViewViewModelProps
> {
    private filtersVm: RoomListPrimaryFiltersViewModel;
    private roomListVm: RoomListViewModel;
    private activeFilter: FilterKey | undefined = undefined;

    public constructor(props: RoomListViewViewModelProps) {
        const isLoadingRooms = RoomListStoreV3.instance.isLoadingRooms;
        const filtersVm = new RoomListPrimaryFiltersViewModel({ client: props.client });
        const roomListVm = new RoomListViewModel({ client: props.client, activeFilter: undefined });

        super(props, RoomListViewViewModel.createSnapshot(
            isLoadingRooms,
            filtersVm,
            roomListVm,
        ));

        this.filtersVm = filtersVm;
        this.roomListVm = roomListVm;

        // Set up filter toggle callback
        this.filtersVm.setToggleCallback(this.onToggleFilter);

        // Listen to room list loaded event
        this.disposables.trackListener(
            RoomListStoreV3.instance,
            RoomListStoreV3Event.ListsLoaded as any,
            this.onListsLoaded,
        );

        // Listen to room list updates
        this.disposables.trackListener(
            RoomListStoreV3.instance,
            RoomListStoreV3Event.ListsUpdate as any,
            this.onListsUpdate,
        );
    }

    private static createSnapshot(
        isLoadingRooms: boolean,
        filtersVm: RoomListPrimaryFiltersViewModel,
        roomListVm: RoomListViewModel,
    ): RoomListViewWrapperSnapshot {
        const roomsResult = roomListVm.getSnapshot().roomsResult;
        const isRoomListEmpty = roomsResult.rooms.length === 0;

        return {
            isLoadingRooms,
            isRoomListEmpty,
            filtersVm,
            roomListVm,
            emptyStateTitle: "No rooms",
            emptyStateDescription: "Start a chat or join a room to see it here",
            emptyStateAction: undefined,
        };
    }

    private onListsLoaded = (): void => {
        this.snapshot.merge({ isLoadingRooms: false });
    };

    private onListsUpdate = (): void => {
        // Child ViewModels will handle their own updates
        // Just update empty state based on current room list
        const roomsResult = this.roomListVm.getSnapshot().roomsResult;
        const isRoomListEmpty = roomsResult.rooms.length === 0;
        this.snapshot.merge({ isRoomListEmpty });
    };

    private onToggleFilter = (filterKey: FilterKey): void => {
        // Toggle the filter - if it's already active, deactivate it
        const newFilter = this.activeFilter === filterKey ? undefined : filterKey;
        this.activeFilter = newFilter;

        // Update the filters ViewModel to show which filter is active
        this.filtersVm.setActiveFilter(newFilter);

        // Update the room list ViewModel with the new filter
        this.roomListVm.setActiveFilter(newFilter);

        // Update empty state based on current room list
        const roomsResult = this.roomListVm.getSnapshot().roomsResult;
        const isRoomListEmpty = roomsResult.rooms.length === 0;
        this.snapshot.merge({ isRoomListEmpty });
    };

    public override dispose(): void {
        this.filtersVm.dispose();
        this.roomListVm.dispose();
        super.dispose();
    }
}

/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BaseViewModel, type SortOptionsMenuSnapshot, SortOption } from "@element-hq/web-shared-components";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";

import RoomListStoreV3, { RoomListStoreV3Event } from "../../../stores/room-list-v3/RoomListStoreV3";
import { SortingAlgorithm } from "../../../stores/room-list-v3/skip-list/sorters";
import SettingsStore from "../../../settings/SettingsStore";

interface SortOptionsMenuViewModelProps {
    client: MatrixClient;
}

/**
 * ViewModel for the SortOptionsMenu component.
 * Manages sort option selection.
 */
export class SortOptionsMenuViewModel extends BaseViewModel<
    SortOptionsMenuSnapshot,
    SortOptionsMenuViewModelProps
> {
    public constructor(props: SortOptionsMenuViewModelProps) {
        super(props, SortOptionsMenuViewModel.createSnapshot());

        // Listen to room list updates that might include sort changes
        this.disposables.trackListener(
            RoomListStoreV3.instance,
            RoomListStoreV3Event.ListsUpdate as any,
            this.onListsUpdate,
        );
    }

    private static createSnapshot(): SortOptionsMenuSnapshot {
        const activeSortingAlgorithm = SettingsStore.getValue("RoomList.preferredSorting");
        const activeSortOption = 
            activeSortingAlgorithm === SortingAlgorithm.Alphabetic ? SortOption.AToZ : SortOption.Activity;

        return {
            activeSortOption,
            sort: SortOptionsMenuViewModel.sort,
        };
    }

    private onListsUpdate = (): void => {
        const activeSortingAlgorithm = SettingsStore.getValue("RoomList.preferredSorting");
        const activeSortOption = 
            activeSortingAlgorithm === SortingAlgorithm.Alphabetic ? SortOption.AToZ : SortOption.Activity;
        
        this.snapshot.merge({ activeSortOption });
    };

    private static sort = (option: SortOption): void => {
        const sortingAlgorithm = 
            option === SortOption.AToZ ? SortingAlgorithm.Alphabetic : SortingAlgorithm.Recency;
        RoomListStoreV3.instance.resort(sortingAlgorithm);
    };
}

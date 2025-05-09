/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import { useState } from "react";

import RoomListStoreV3 from "../../../stores/room-list-v3/RoomListStoreV3";
import { SortingAlgorithm } from "../../../stores/room-list-v3/skip-list/sorters";
import SettingsStore from "../../../settings/SettingsStore";

/**
 * Sorting options made available to the view.
 */
export const enum SortOption {
    Activity = SortingAlgorithm.Recency,
    AToZ = SortingAlgorithm.Alphabetic,
}

/**
 * {@link SortOption} holds almost the same information as
 * {@link SortingAlgorithm}. This is done intentionally to
 * prevent the view from having a dependence on the
 * model (which is the store in this case).
 */
const sortingAlgorithmToSortingOption = {
    [SortingAlgorithm.Alphabetic]: SortOption.AToZ,
    [SortingAlgorithm.Recency]: SortOption.Activity,
};

const sortOptionToSortingAlgorithm = {
    [SortOption.AToZ]: SortingAlgorithm.Alphabetic,
    [SortOption.Activity]: SortingAlgorithm.Recency,
};

interface SortState {
    sort: (option: SortOption) => void;
    activeSortOption: SortOption;
}

/**
 * This hook does two things:
 * - Provides a way to track the currently active sort option.
 * - Provides a function to resort the room list.
 */
export function useSorter(): SortState {
    const [activeSortingAlgorithm, setActiveSortingAlgorithm] = useState(() =>
        SettingsStore.getValue("RoomList.preferredSorting"),
    );

    const sort = (option: SortOption): void => {
        const sortingAlgorithm = sortOptionToSortingAlgorithm[option];
        RoomListStoreV3.instance.resort(sortingAlgorithm);
        setActiveSortingAlgorithm(sortingAlgorithm);
    };

    return {
        sort,
        activeSortOption: sortingAlgorithmToSortingOption[activeSortingAlgorithm!],
    };
}

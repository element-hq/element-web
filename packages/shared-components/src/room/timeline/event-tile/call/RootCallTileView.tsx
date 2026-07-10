/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import { useViewModel, type ViewModel } from "../../../../core/viewmodel";
import {
    RoomTombstoneCallTileView,
    type RoomTombstoneCallTileViewModel,
} from "./tombstone/room/RoomTombstoneCallTileView";
import { DmTombstoneCallTileView, type DmTombstoneCallTileViewModel } from "./tombstone/dm/DmTombstoneCallTileView";

/**
 * Map from tile type to view model.
 */
interface TileTypeToViewModelMap {
    "tombstone-call-room": RoomTombstoneCallTileViewModel;
    "tombstone-call-dm": DmTombstoneCallTileViewModel;
}

export interface RootCallTileViewSnapshot<Type extends keyof TileTypeToViewModelMap = keyof TileTypeToViewModelMap> {
    tileType: Type;
    tileViewModel: TileTypeToViewModelMap[Type];
}

export type RootCallTileViewModel = ViewModel<RootCallTileViewSnapshot>;

interface Props {
    vm: RootCallTileViewModel;
}

/**
 * Root view for a call tile in the timeline.
 */
export function RootCallTileView({ vm }: Props): React.ReactNode {
    const { tileType, tileViewModel } = useViewModel(vm);
    switch (tileType) {
        case "tombstone-call-room":
            return <RoomTombstoneCallTileView vm={tileViewModel as TileTypeToViewModelMap["tombstone-call-room"]} />;
        case "tombstone-call-dm":
            return <DmTombstoneCallTileView vm={tileViewModel as TileTypeToViewModelMap["tombstone-call-dm"]} />;
    }
}

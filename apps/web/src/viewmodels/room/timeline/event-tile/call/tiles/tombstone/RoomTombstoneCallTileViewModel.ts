/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseViewModel, type RoomTombstoneCallTileViewSnapshot } from "@element-hq/web-shared-components";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import type { GetRelationsForEvent } from "../../../../../../../components/views/rooms/EventTile";

export interface RoomTombstoneCallTileViewModelProps {
    /**
     * Event of type `org.matrix.msc4075.rtc.notification`.
     */
    mxEvent: MatrixEvent;
    /**
     * Helper to fetch related events from a given event.
     */
    getRelationsForEvent?: GetRelationsForEvent;
}

/**
 * View model for a tombstone call in a room. The tile's time is the
 * timeline's own timestamp, like any other event's.
 */
export class RoomTombstoneCallTileViewModel<
    T extends RoomTombstoneCallTileViewSnapshot = RoomTombstoneCallTileViewSnapshot,
    P extends RoomTombstoneCallTileViewModelProps = RoomTombstoneCallTileViewModelProps,
> extends BaseViewModel<T, P> {
    public constructor(props: P, extraSnapshot: Partial<T> = {}) {
        super(props, extraSnapshot as T);
    }
}

/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { BaseViewModel, type RootCallTileViewSnapshot } from "@element-hq/web-shared-components";

import type { GetRelationsForEvent } from "../../../../../components/views/rooms/EventTile";
import { DmTombstoneCallTileViewModel } from "./tiles/tombstone/DmTombstoneCallTileViewModel";
import { RoomTombstoneCallTileViewModel } from "./tiles/tombstone/RoomTombstoneCallTileViewModel";

interface Props {
    /**
     * Event of type `org.matrix.msc4075.rtc.notification`.
     */
    mxEvent: MatrixEvent;

    /**
     * Helper to fetch related events from a given event.
     */
    getRelationsForEvent?: GetRelationsForEvent;

    /**
     * The {@link MatrixClient} object to access js-sdk API.
     */
    cli: MatrixClient;
}

function computeSnapshot(props: Props): RootCallTileViewSnapshot {
    const cli = props.cli;
    const notificationEvent = props.mxEvent;

    // Get the room where this call is taking place
    const roomId = props.mxEvent.getRoomId();
    if (!roomId) throw new Error("Notification event does not have associated room-id");
    const room = cli.getRoom(roomId);
    if (!room) throw new Error(`No room with id ${roomId}`);

    // This is the same logic used for hiding/showing the voice call button.
    const isDmRoom = room.getMembers().length <= 2;

    if (isDmRoom) {
        return {
            tileType: "tombstone-call-dm",
            tileViewModel: new DmTombstoneCallTileViewModel({
                mxEvent: notificationEvent,
                getRelationsForEvent: props.getRelationsForEvent,
                cli: props.cli,
            }),
        };
    } else
        return {
            tileType: "tombstone-call-room",
            tileViewModel: new RoomTombstoneCallTileViewModel({ mxEvent: notificationEvent }),
        };
}

/**
 * The root call tile view model which decides what call tile should be rendered.
 */
export class RootCallTileViewModel extends BaseViewModel<RootCallTileViewSnapshot, Props> {
    public constructor(props: Props) {
        const snapshot = computeSnapshot(props);
        super(props, snapshot);
    }
}

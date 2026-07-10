/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { CallDirection, type DmTombstoneCallTileViewSnapshot } from "@element-hq/web-shared-components";
import { type MatrixClient, type MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";

import SettingsStore from "../../../../../../../settings/SettingsStore";
import type { GetRelationsForEvent } from "../../../../../../../components/views/rooms/EventTile";
import { getTimeFromEvent } from "./common";
import {
    RoomTombstoneCallTileViewModel,
    type RoomTombstoneCallTileViewModelProps,
} from "./RoomTombstoneCallTileViewModel";
import { getDeclinedEvents, getIntentFromEvent } from "../../common";

export interface DmTombstoneCallTileViewModelProps extends RoomTombstoneCallTileViewModelProps {
    /**
     * Helper to fetch related events from a given event.
     */
    getRelationsForEvent?: GetRelationsForEvent;
    /**
     * The {@link MatrixClient} object to access js-sdk API.
     */
    cli: MatrixClient;
}

function generateSnapshot(props: DmTombstoneCallTileViewModelProps): {
    snapshot: DmTombstoneCallTileViewSnapshot;
    declineEvent: MatrixEvent | null;
} {
    const { mxEvent, getRelationsForEvent, cli } = props;
    const type = getIntentFromEvent(mxEvent);

    // Find the mx-id of the user who started this call
    const startedUserId = mxEvent.getSender();
    if (!startedUserId) {
        throw new Error("RTCNotification event has no sender associated with it!");
    }
    const callDirection = cli.getUserId() === startedUserId ? CallDirection.Outgoing : CallDirection.Incoming;

    const declineEvent = getDeclinedEvents(mxEvent, getRelationsForEvent)?.[0] ?? null;
    const showTwelveHour = SettingsStore.getValue("showTwelveHourTimestamps");
    const timestamp = getTimeFromEvent(declineEvent ?? mxEvent, showTwelveHour);
    return { snapshot: { timestamp, type, callDirection, isCallDeclined: !!declineEvent }, declineEvent };
}

/**
 * View model for a tombstone call in a DM.
 */
export class DmTombstoneCallTileViewModel extends RoomTombstoneCallTileViewModel<
    DmTombstoneCallTileViewSnapshot,
    DmTombstoneCallTileViewModelProps
> {
    /**
     * The decline event associated with this call, if any.
     */
    private declineEvent: MatrixEvent | null;

    public constructor(props: DmTombstoneCallTileViewModelProps) {
        const { snapshot, declineEvent } = generateSnapshot(props);
        super(props, snapshot);
        this.declineEvent = declineEvent;

        // When a relation is added to the event, recompute the state.
        this.disposables.trackListener(props.mxEvent, MatrixEventEvent.RelationsCreated, () => {
            const { declineEvent, snapshot } = generateSnapshot(props);
            this.declineEvent = declineEvent;
            this.snapshot.set(snapshot);
        });
    }

    protected getTimestamp(showTwelveHour: boolean): string {
        return getTimeFromEvent(this.declineEvent ?? this.props.mxEvent, showTwelveHour);
    }
}

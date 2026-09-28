/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { CallDirection, type DmTombstoneCallTileViewSnapshot } from "@element-hq/web-shared-components";
import { EventType, type MatrixClient, type MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";

import SettingsStore from "../../../../../../../settings/SettingsStore";
import type { GetRelationsForEvent } from "../../../../../../../components/views/rooms/EventTile";
import { getTimeFromEvent } from "./common";
import {
    RoomTombstoneCallTileViewModel,
    type RoomTombstoneCallTileViewModelProps,
} from "./RoomTombstoneCallTileViewModel";
import { getDeclinedEvents, getFailureReason, getIntentFromEvent } from "../../common";

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

/**
 * Whether the local user joined the call this notification rang for: a call
 * membership of theirs in the timeline after the notification, before the next
 * one. A join follows the ring within seconds, so it is loaded alongside.
 */
function didWeAnswer(cli: MatrixClient, mxEvent: MatrixEvent): boolean {
    const eventId = mxEvent.getId();
    const events = eventId && cli.getRoom(mxEvent.getRoomId())?.getTimelineForEvent?.(eventId)?.getEvents();
    if (!events) return false;
    const after = events.slice(events.findIndex((e) => e.getId() === eventId) + 1);
    for (const e of after) {
        if (e.getType() === EventType.RTCNotification) break;
        if (
            e.getType() === EventType.GroupCallMemberPrefix &&
            e.getSender() === cli.getUserId() &&
            Object.keys(e.getContent()).length > 0
        )
            return true;
    }
    return false;
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
    const failureReason = getFailureReason(mxEvent, getRelationsForEvent);
    const showTwelveHour = SettingsStore.getValue("showTwelveHourTimestamps");
    const timestamp = getTimeFromEvent(declineEvent ?? mxEvent, showTwelveHour);
    const answered = didWeAnswer(cli, mxEvent);
    return {
        snapshot: { timestamp, type, callDirection, isCallDeclined: !!declineEvent, failureReason, answered },
        declineEvent,
    };
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

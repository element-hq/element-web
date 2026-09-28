/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { CallDirection, type DmTombstoneCallTileViewSnapshot } from "@element-hq/web-shared-components";
import { EventType, type MatrixClient, type MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";

import type { GetRelationsForEvent } from "../../../../../../../components/views/rooms/EventTile";
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
 * What the timeline says became of the call this notification rang for: the
 * call memberships after it, before the next ring. A join follows the ring
 * within seconds, so it is loaded alongside; the leave may not be.
 */
function callOutcome(cli: MatrixClient, mxEvent: MatrixEvent): { answered: boolean; durationSeconds?: number } {
    const eventId = mxEvent.getId();
    const events = eventId && cli.getRoom(mxEvent.getRoomId())?.getTimelineForEvent?.(eventId)?.getEvents();
    if (!events) return { answered: false };
    const after = events.slice(events.findIndex((e) => e.getId() === eventId) + 1);
    let answered = false;
    // Connected once someone other than the caller joins; over when anyone leaves
    let connectedTs: number | undefined;
    for (const e of after) {
        if (e.getType() === EventType.RTCNotification) break;
        if (e.getType() !== EventType.GroupCallMemberPrefix) continue;
        const joined = Object.keys(e.getContent()).length > 0;
        if (joined && e.getSender() === cli.getUserId()) answered = true;
        if (joined && connectedTs === undefined && e.getSender() !== mxEvent.getSender()) connectedTs = e.getTs();
        else if (!joined && connectedTs !== undefined)
            return { answered, durationSeconds: Math.max(0, Math.round((e.getTs() - connectedTs) / 1000)) };
    }
    return { answered };
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
    const { answered, durationSeconds } = callOutcome(cli, mxEvent);
    return {
        snapshot: { type, callDirection, isCallDeclined: !!declineEvent, failureReason, answered, durationSeconds },
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
    public constructor(props: DmTombstoneCallTileViewModelProps) {
        super(props, generateSnapshot(props).snapshot);

        // When a relation is added to the event, recompute the state.
        this.disposables.trackListener(props.mxEvent, MatrixEventEvent.RelationsCreated, () => {
            this.snapshot.set(generateSnapshot(props).snapshot);
        });
    }
}

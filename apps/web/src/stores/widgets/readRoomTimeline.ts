/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { EventType, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";

interface ReadRoomTimelineOptions {
    /** The event type to read. */
    eventType: string;
    /** For `m.room.message`, only events with this `msgtype`. */
    msgtype?: string;
    /** Only events with this state key. */
    stateKey?: string;
    /** The maximum number of events to yield. */
    limit: number;
    /** Stop at (and exclude) this event ID. */
    since?: string;
}

/**
 * Walks the live timeline of a room from the most recent event backwards, yielding the events a
 * widget may read. Shared by the widget host implementations' "read events" handlers.
 * @yields the matching events, most recent first.
 */
export function* readRoomTimeline(room: Room, opts: ReadRoomTimelineOptions): Generator<MatrixEvent, void, void> {
    const { eventType, msgtype, stateKey, limit, since } = opts;
    let resultCount: number = 0;
    const events = [...room.getLiveTimeline().getEvents()]; // timelines are most recent last
    for (let ev = events.pop(); ev && resultCount < limit && ev.getId() !== since; ev = events.pop()) {
        if (ev.getType() !== eventType) continue;
        if (eventType === EventType.RoomMessage && msgtype && msgtype !== ev.getContent()["msgtype"]) continue;
        if (stateKey !== undefined && ev.getStateKey() !== stateKey) continue;
        yield ev;
        resultCount++;
    }
}

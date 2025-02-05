/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    type Room,
    RoomEvent,
    RoomStateEvent,
    MatrixEvent,
    EventType,
    RelationType,
    EventTimeline,
    type MatrixClient,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { useTypedEventEmitter } from "./useEventEmitter";
import { ReadPinsEventId } from "../components/views/right_panel/types";
import { useMatrixClientContext } from "../contexts/MatrixClientContext";
import { useAsyncMemo } from "./useAsyncMemo";
import PinningUtils from "../utils/PinningUtils";
import { batch } from "../utils/promise.ts";

/**
 * Get the pinned event IDs from a room.
 * The number of pinned events is limited to 100.
 * @param room
 */
function getPinnedEventIds(room?: Room): string[] {
    const eventIds: string[] =
        room
            ?.getLiveTimeline()
            .getState(EventTimeline.FORWARDS)
            ?.getStateEvents(EventType.RoomPinnedEvents, "")
            ?.getContent()?.pinned ?? [];
    // Limit the number of pinned events to 100
    return eventIds.slice(0, 100);
}

/**
 * Get the pinned event IDs from a room.
 * @param room
 */
export const usePinnedEvents = (room?: Room): string[] => {
    const [pinnedEvents, setPinnedEvents] = useState<string[]>(getPinnedEventIds(room));

    // Update the pinned events when the room state changes
    // Filter out events that are not pinned events
    const update = useCallback(
        (ev?: MatrixEvent) => {
            if (ev && ev.getType() !== EventType.RoomPinnedEvents) return;
            setPinnedEvents(getPinnedEventIds(room));
        },
        [room],
    );

    useTypedEventEmitter(room?.getLiveTimeline().getState(EventTimeline.FORWARDS), RoomStateEvent.Events, update);
    useEffect(() => {
        setPinnedEvents(getPinnedEventIds(room));
        return () => {
            setPinnedEvents([]);
        };
    }, [room]);
    return pinnedEvents;
};

/**
 * Get the read pinned event IDs from a room.
 * @param room
 */
function getReadPinnedEventIds(room?: Room): Set<string> {
    return new Set(room?.getAccountData(ReadPinsEventId)?.getContent()?.event_ids ?? []);
}

/**
 * Get the read pinned event IDs from a room.
 * @param room
 */
export const useReadPinnedEvents = (room?: Room): Set<string> => {
    const [readPinnedEvents, setReadPinnedEvents] = useState<Set<string>>(new Set());

    // Update the read pinned events when the room state changes
    // Filter out events that are not read pinned events
    const update = useCallback(
        (ev?: MatrixEvent) => {
            if (ev && ev.getType() !== ReadPinsEventId) return;
            setReadPinnedEvents(getReadPinnedEventIds(room));
        },
        [room],
    );

    useTypedEventEmitter(room, RoomEvent.AccountData, update);
    useEffect(() => {
        setReadPinnedEvents(getReadPinnedEventIds(room));
        return () => {
            setReadPinnedEvents(new Set());
        };
    }, [room]);
    return readPinnedEvents;
};

/**
 * Fetch the pinned event
 * @param room
 * @param pinnedEventId
 * @param cli
 */
async function fetchPinnedEvent(room: Room, pinnedEventId: string, cli: MatrixClient): Promise<MatrixEvent | null> {
    const timelineSet = room.getUnfilteredTimelineSet();
    // Get the event from the local timeline
    const localEvent = timelineSet
        ?.getTimelineForEvent(pinnedEventId)
        ?.getEvents()
        .find((e) => e.getId() === pinnedEventId);

    // Decrypt the event if it's encrypted
    // Can happen when the tab is refreshed and the pinned events card is opened directly
    if (localEvent?.isEncrypted()) {
        await cli.decryptEventIfNeeded(localEvent, { emit: false });
    }

    // If the event is available locally, return it if it's pinnable
    // or if it's redacted (to show the redacted event and to be able to unpin it)
    // Otherwise, return null
    if (localEvent) return PinningUtils.isUnpinnable(localEvent) ? localEvent : null;

    try {
        // The event is not available locally, so we fetch the event and latest edit in parallel
        const [
            evJson,
            {
                events: [edit],
            },
        ] = await Promise.all([
            cli.fetchRoomEvent(room.roomId, pinnedEventId),
            cli.relations(room.roomId, pinnedEventId, RelationType.Replace, null, { limit: 1 }),
        ]);

        const event = new MatrixEvent(evJson);

        // Decrypt the event if it's encrypted
        if (event.isEncrypted()) {
            await cli.decryptEventIfNeeded(event, { emit: false });
        }

        // Handle poll events
        await room.processPollEvents([event]);

        const senderUserId = event.getSender();
        if (senderUserId && PinningUtils.isUnpinnable(event)) {
            // Inject sender information
            event.setMetadata(room.currentState, false);
            // Also inject any edits we've found
            if (edit) event.makeReplaced(edit);

            return event;
        }
    } catch (err) {
        logger.error(`Error looking up pinned event ${pinnedEventId} in room ${room.roomId}`);
        logger.error(err);
    }
    return null;
}

/**
 * Fetch the pinned events
 * @param room
 * @param pinnedEventIds
 */
export function useFetchedPinnedEvents(room: Room, pinnedEventIds: string[]): Array<MatrixEvent | null> | null {
    const cli = useMatrixClientContext();

    return useAsyncMemo(
        () => {
            const fetchPromises = pinnedEventIds.map((eventId) => () => fetchPinnedEvent(room, eventId, cli));
            // Fetch the pinned events in batches of 10
            return batch(fetchPromises, 10);
        },
        [cli, room, pinnedEventIds],
        null,
    );
}

/**
 * Fetch the pinned events and sort them by from the oldest to the newest
 * The order is determined by the event timestamp
 * @param room
 * @param pinnedEventIds
 */
export function useSortedFetchedPinnedEvents(room: Room, pinnedEventIds: string[]): Array<MatrixEvent | null> {
    const pinnedEvents = useFetchedPinnedEvents(room, pinnedEventIds);
    return useMemo(() => {
        if (!pinnedEvents) return [];

        return pinnedEvents.sort((a, b) => {
            if (!a) return -1;
            if (!b) return 1;
            return a.getTs() - b.getTs();
        });
    }, [pinnedEvents]);
}

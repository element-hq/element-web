/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ClientEvent,
    type MatrixClient,
    MatrixEventEvent,
    NotificationCountType,
    type Room,
    type Thread,
} from "matrix-js-sdk/src/matrix";
import { throttle } from "lodash";

import { doesTimelineHaveUnreadMessages } from "../../../../Unread";
import { NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import { getThreadNotificationLevel } from "../../../../utils/notifications";
import { useSettingValue } from "../../../../hooks/useSettings";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { useEventEmitter } from "../../../../hooks/useEventEmitter";
import { isRoomVisible } from "../../../../stores/room-list-v3/isRoomVisible";
import { getRoomNotifsState, RoomNotifState } from "../../../../RoomNotifs";

const MIN_UPDATE_INTERVAL_MS = 500;

export type ThreadData = {
    thread: Thread;
    room: Room;
    notificationLevel: NotificationLevel;
};

type Result = {
    greatestNotificationLevel: NotificationLevel;
    rooms: Array<{ room: Room; notificationLevel: NotificationLevel }>;
    participatingThreads: Array<ThreadData>;
    otherThreads: Array<ThreadData>;
};

/**
 * Return the greatest notification level of all thread, the list of rooms with unread threads, and their notification level.
 * The result is computed when the client syncs, or when forceComputation is true
 * @param forceComputation
 * @returns {Result}
 */
export function useUnreadThreadRooms(forceComputation: boolean): Result {
    const msc3946ProcessDynamicPredecessor = useSettingValue("feature_dynamic_room_predecessors");
    const settingTACOnlyNotifs = useSettingValue("Notifications.tac_only_notifications");
    const mxClient = useMatrixClientContext();

    const [result, setResult] = useState<Result>({
        greatestNotificationLevel: NotificationLevel.None,
        rooms: [],
        participatingThreads: [],
        otherThreads: [],
    });

    const doUpdate = useCallback(() => {
        setResult(computeUnreadThreadRooms(mxClient, msc3946ProcessDynamicPredecessor, settingTACOnlyNotifs));
    }, [mxClient, msc3946ProcessDynamicPredecessor, settingTACOnlyNotifs]);

    const scheduleUpdate = useMemo(
        () =>
            throttle(doUpdate, MIN_UPDATE_INTERVAL_MS, {
                leading: false,
                trailing: true,
            }),
        [doUpdate],
    );

    // Listen to sync events to update the result
    useEventEmitter(mxClient, ClientEvent.Sync, scheduleUpdate);
    // and also when events get decrypted, since this will often happen after the sync
    // event and may change notifications.
    useEventEmitter(mxClient, MatrixEventEvent.Decrypted, scheduleUpdate);

    // Force the list computation
    useEffect(() => {
        if (forceComputation) {
            doUpdate();
        }
    }, [doUpdate, forceComputation]);

    return result;
}

/**
 * Compute the list of unread threads, split into "my threads" (relevant to the user)
 * and "other threads" (everything else), along with notification levels.
 *
 * Categorisation (mutually exclusive) — server-driven:
 * - "My threads": {@link Thread.hasCurrentUserParticipated} (from the server's
 *   `current_user_participated` field in bundled `m.thread` relations) OR
 *   the thread has a server highlight count > 0 (a mention/keyword for the user).
 * - "Other threads": every other unread thread.
 *
 * The `settingTACOnlyNotifs` setting (`Notifications.tac_only_notifications`) is
 * **scoped to "Other threads" only**. Threads relevant to the user are always shown,
 * regardless of the setting:
 *
 * - "My threads": always includes any unread thread the user has participated in
 *   (or has a highlight for), whether the unread comes from server notification
 *   counts or local timeline inspection. Muted rooms still contribute here — a
 *   thread you replied in, or where you were mentioned, should reach you even
 *   when the room itself is muted.
 * - "Other threads":
 *   - setting = false (default): include both server-notified and local-activity
 *     unreads (but skip muted rooms — non-relevant threads from muted rooms are
 *     noise by definition).
 *   - setting = true: only include threads with server-reported counts (drops
 *     activity-only threads that the homeserver hasn't pushed notifications for).
 *
 * Local unread detection has known limitations (timeline window may not cover the
 * full history); the setting lets users mute the noisier "Other threads" list while
 * keeping personally-relevant threads visible.
 *
 * The `rooms` array and `greatestNotificationLevel` only reflect rooms that
 * contribute at least one displayed thread, so the indicator badge matches what
 * the user will actually see in the popup.
 *
 * Note: we intentionally do NOT pre-filter rooms via `doesRoomHaveUnreadThreads()`.
 * That helper short-circuits on muted rooms and on rooms where the local timeline
 * has no detected unread — both of which can mask server-flagged highlights and
 * participated threads. Iterating per-thread is cheap (server counts are O(1)
 * lookups) and avoids those false negatives.
 *
 * @param mxClient - MatrixClient
 * @param msc3946ProcessDynamicPredecessor
 * @param settingTACOnlyNotifs
 */
function computeUnreadThreadRooms(
    mxClient: MatrixClient,
    msc3946ProcessDynamicPredecessor: boolean,
    settingTACOnlyNotifs: boolean,
): Result {
    // Only count visible rooms to not torment the user with notification counts in rooms they can't see.
    // This will include highlights from the previous version of the room internally
    const visibleRooms = mxClient.getVisibleRooms(msc3946ProcessDynamicPredecessor);

    let greatestNotificationLevel = NotificationLevel.None;
    const rooms: Result["rooms"] = [];
    const participatingThreads: ThreadData[] = [];
    const otherThreads: ThreadData[] = [];

    for (const room of visibleRooms) {
        if (!isRoomVisible(room)) continue;

        const isRoomMuted = getRoomNotifsState(room.client, room.roomId) === RoomNotifState.Mute;
        let roomContributedThread = false;

        for (const thread of room.getThreads()) {
            // Primary signal: server-reported notification counts (authoritative).
            const highlight = room.getThreadUnreadNotificationCount(thread.id, NotificationCountType.Highlight);
            const total = room.getThreadUnreadNotificationCount(thread.id, NotificationCountType.Total);
            const hasServerNotifs = highlight > 0 || total > 0;

            // Fallback: local timeline inspection — surfaces threads the homeserver
            // hasn't pushed notification counts for. Computed lazily (skip when the
            // server already gave us a signal).
            const hasLocalActivity = hasServerNotifs || doesTimelineHaveUnreadMessages(room, thread.events);

            if (!hasServerNotifs && !hasLocalActivity) continue;

            const threadNotifLevel =
                highlight > 0
                    ? NotificationLevel.Highlight
                    : total > 0
                      ? NotificationLevel.Notification
                      : NotificationLevel.Activity;

            // "My threads" is relevant to the user: participated OR mentioned/keyword.
            const isRelevantToMe = thread.hasCurrentUserParticipated || highlight > 0;

            if (isRelevantToMe) {
                // Always shown, even when the room is muted or settingTACOnlyNotifs is on.
                participatingThreads.push({ thread, room, notificationLevel: threadNotifLevel });
                roomContributedThread = true;
            } else {
                // Muted rooms shouldn't surface non-relevant threads in Other threads.
                if (isRoomMuted) continue;
                // Setting scopes to Other threads: when on, drop activity-only entries.
                if (settingTACOnlyNotifs && !hasServerNotifs) continue;
                otherThreads.push({ thread, room, notificationLevel: threadNotifLevel });
                roomContributedThread = true;
            }
        }

        // Only surface the room in the indicator if at least one of its threads is shown.
        if (roomContributedThread) {
            const notificationLevel = getThreadNotificationLevel(room);
            if (notificationLevel > greatestNotificationLevel) {
                greatestNotificationLevel = notificationLevel;
            }
            rooms.push({ room, notificationLevel });
        }
    }

    const sortThreads = (a: ThreadData, b: ThreadData): number => {
        if (a.notificationLevel !== b.notificationLevel) return b.notificationLevel - a.notificationLevel;
        const tsA = a.thread.events.at(-1)?.getTs() ?? 0;
        const tsB = b.thread.events.at(-1)?.getTs() ?? 0;
        return tsB - tsA;
    };

    const sortedRooms = rooms.sort((a, b) => sortRoom(a, b));
    participatingThreads.sort(sortThreads);
    otherThreads.sort(sortThreads);

    return { greatestNotificationLevel, rooms: sortedRooms, participatingThreads, otherThreads };
}

/**
 * Store the room and its thread notification level
 */
type RoomData = Result["rooms"][0];

/**
 * Sort notification level by the most important notification level to the least important
 * Highlight > Notification > Activity
 * If the notification level is the same, we sort by the most recent thread
 * @param roomDataA - room and notification level of room A
 * @param roomDataB - room and notification level of room B
 * @returns {number}
 */
function sortRoom(roomDataA: RoomData, roomDataB: RoomData): number {
    const { notificationLevel: notificationLevelA, room: roomA } = roomDataA;
    const { notificationLevel: notificationLevelB, room: roomB } = roomDataB;

    const timestampA = roomA.getLastThread()?.events.at(-1)?.getTs();
    const timestampB = roomB.getLastThread()?.events.at(-1)?.getTs();

    // NotificationLevel is a numeric enum, so we can compare them directly
    if (notificationLevelA > notificationLevelB) return -1;
    else if (notificationLevelB > notificationLevelA) return 1;
    // Display most recent first
    else if (!timestampA) return 1;
    else if (!timestampB) return -1;
    else return timestampB - timestampA;
}

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

import { doesRoomHaveUnreadThreads, doesTimelineHaveUnreadMessages } from "../../../../Unread";
import { NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import { getThreadNotificationLevel } from "../../../../utils/notifications";
import { useSettingValue } from "../../../../hooks/useSettings";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { useEventEmitter } from "../../../../hooks/useEventEmitter";
import { isRoomVisible } from "../../../../stores/room-list-v3/isRoomVisible";

const MIN_UPDATE_INTERVAL_MS = 500;

export type ThreadData = {
    thread: Thread;
    room: Room;
    notificationLevel: NotificationLevel;
};

type Result = {
    greatestNotificationLevel: NotificationLevel;
    rooms: Array<{ room: Room; notificationLevel: NotificationLevel }>;
    allUnreadThreads: Array<ThreadData>;
    participatingThreads: Array<ThreadData>;
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
        allUnreadThreads: [],
        participatingThreads: [],
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
 * Compute the greatest notification level of all thread, the list of rooms with unread threads, and their notification level.
 * Also computes the list of unread threads in which the current user has participated, across all rooms.
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
    const userId = mxClient.getUserId();

    let greatestNotificationLevel = NotificationLevel.None;
    const rooms: Result["rooms"] = [];
    const allUnreadThreads: ThreadData[] = [];
    const participatingThreads: ThreadData[] = [];

    for (const room of visibleRooms) {
        // We only care about rooms with unread threads
        if (!isRoomVisible(room) || !doesRoomHaveUnreadThreads(room)) continue;

        // Get the greatest notification level of all threads
        const notificationLevel = getThreadNotificationLevel(room);

        const roomPassesFilter = !settingTACOnlyNotifs || notificationLevel > NotificationLevel.Activity;

        // If the room has an activity notification or less, we ignore it for the Rooms tab
        if (roomPassesFilter) {
            if (notificationLevel > greatestNotificationLevel) {
                greatestNotificationLevel = notificationLevel;
            }
            rooms.push({ room, notificationLevel });
        }

        for (const thread of room.getThreads()) {
            // Use server-reported notification counts as the primary unread signal
            // (more reliable than local timeline inspection which may be incomplete).
            // Fall back to timeline inspection for activity-level unread (no count).
            const highlight = room.getThreadUnreadNotificationCount(thread.id, NotificationCountType.Highlight);
            const total = room.getThreadUnreadNotificationCount(thread.id, NotificationCountType.Total);
            const hasNotifications = highlight > 0 || total > 0;
            const hasActivity = doesTimelineHaveUnreadMessages(room, thread.timeline);
            if (!hasNotifications && !hasActivity) continue;

            const threadNotifLevel =
                highlight > 0
                    ? NotificationLevel.Highlight
                    : total > 0
                      ? NotificationLevel.Notification
                      : NotificationLevel.Activity;

            // "All threads" tab: every unread thread from rooms that pass the Rooms filter
            if (roomPassesFilter) {
                allUnreadThreads.push({ thread, room, notificationLevel: threadNotifLevel });
            }

            // "My threads" tab: unread threads the user participated in, across all rooms.
            // settingTACOnlyNotifs is intentionally NOT applied — show all participated threads.
            if (userId) {
                const participated =
                    thread.rootEvent?.getSender() === userId ||
                    thread.timeline.some((e) => e.getSender() === userId);
                if (participated) {
                    participatingThreads.push({ thread, room, notificationLevel: threadNotifLevel });
                }
            }
        }
    }

    const sortThreads = (a: ThreadData, b: ThreadData): number => {
        if (a.notificationLevel !== b.notificationLevel) return b.notificationLevel - a.notificationLevel;
        const tsA = a.thread.timeline.at(-1)?.getTs() ?? 0;
        const tsB = b.thread.timeline.at(-1)?.getTs() ?? 0;
        return tsB - tsA;
    };

    const sortedRooms = rooms.sort((a, b) => sortRoom(a, b));
    allUnreadThreads.sort(sortThreads);
    participatingThreads.sort(sortThreads);

    return { greatestNotificationLevel, rooms: sortedRooms, allUnreadThreads, participatingThreads };
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

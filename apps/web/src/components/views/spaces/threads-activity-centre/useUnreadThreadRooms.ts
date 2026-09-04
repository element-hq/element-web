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
    THREAD_RELATION_TYPE,
} from "matrix-js-sdk/src/matrix";
import { throttle } from "lodash";

import { doesTimelineHaveUnreadMessages, eventTriggersUnreadCount } from "../../../../Unread";
import { NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import { getThreadNotificationLevel } from "../../../../utils/notifications";
import { useSettingValue } from "../../../../hooks/useSettings";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { useEventEmitter } from "../../../../hooks/useEventEmitter";
import { isRoomVisible } from "../../../../stores/room-list-v3/isRoomVisible";
import { getRoomNotifsState, RoomNotifState } from "../../../../RoomNotifs";

const MIN_UPDATE_INTERVAL_MS = 500;

/**
 * An unread thread displayed in the Threads Activity Centre.
 */
export type ThreadData = {
    /** The unread thread. */
    thread: Thread;
    /** The room the thread belongs to. */
    room: Room;
    /** The notification level of the thread. */
    notificationLevel: NotificationLevel;
};

/**
 * The unread threads to display in the Threads Activity Centre.
 */
export type UnreadThreadRooms = {
    /** The highest notification level across all the displayed threads. */
    greatestNotificationLevel: NotificationLevel;
    /** The rooms contributing at least one displayed thread, and their notification level. */
    rooms: Array<{ room: Room; notificationLevel: NotificationLevel }>;
    /** The unread threads relevant to the user, shown in the "My threads" tab. */
    participatingThreads: ThreadData[];
    /** The other unread threads, shown in the "Other threads" tab. */
    otherThreads: ThreadData[];
};

/**
 * Return the unread threads split into "my threads" and "other threads", the rooms that
 * contribute at least one displayed thread, and the greatest notification level across them.
 * See {@link computeUnreadThreadRooms} for how threads are categorised.
 * The result is computed when the client syncs, or when forceComputation is true.
 * @param forceComputation
 * @returns {UnreadThreadRooms}
 */
export function useUnreadThreadRooms(forceComputation: boolean): UnreadThreadRooms {
    const msc3946ProcessDynamicPredecessor = useSettingValue("feature_dynamic_room_predecessors");
    const settingTACOnlyNotifs = useSettingValue("Notifications.tac_only_notifications");
    const mxClient = useMatrixClientContext();

    const [result, setResult] = useState<UnreadThreadRooms>({
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
 * A thread goes to "My threads" when the user participated in it or was mentioned in it,
 * and to "Other threads" otherwise. "My threads" is always shown in full; "Other threads"
 * skips muted rooms, and, when `settingTACOnlyNotifs` is on, threads without a
 * server-reported notification count.
 *
 * `rooms` and `greatestNotificationLevel` only cover rooms contributing a displayed thread,
 * so the indicator badge matches the popup content.
 *
 * @param mxClient - MatrixClient
 * @param msc3946ProcessDynamicPredecessor
 * @param settingTACOnlyNotifs
 */
function computeUnreadThreadRooms(
    mxClient: MatrixClient,
    msc3946ProcessDynamicPredecessor: boolean,
    settingTACOnlyNotifs: boolean,
): UnreadThreadRooms {
    // Only count visible rooms to not torment the user with notification counts in rooms they can't see.
    // This will include highlights from the previous version of the room internally
    const visibleRooms = mxClient.getVisibleRooms(msc3946ProcessDynamicPredecessor);

    let greatestNotificationLevel = NotificationLevel.None;
    const rooms: UnreadThreadRooms["rooms"] = [];
    const participatingThreads: ThreadData[] = [];
    const otherThreads: ThreadData[] = [];

    for (const room of visibleRooms) {
        if (!isRoomVisible(room)) continue;

        const isRoomMuted = getRoomNotifsState(room.client, room.roomId) === RoomNotifState.Mute;
        let roomContributedThread = false;

        for (const thread of room.getThreads()) {
            const unread = evaluateThreadUnread(mxClient, room, thread);
            if (!unread) continue;

            if (unread.isRelevantToMe) {
                // "My threads": always shown, even when the room is muted or settingTACOnlyNotifs is on.
                participatingThreads.push({ thread, room, notificationLevel: unread.notificationLevel });
            } else {
                // Muted rooms shouldn't surface non-relevant threads in Other threads.
                if (isRoomMuted) continue;
                // The setting scopes to Other threads: when on, drop activity-only entries.
                if (settingTACOnlyNotifs && !unread.hasServerNotifs) continue;
                otherThreads.push({ thread, room, notificationLevel: unread.notificationLevel });
            }
            roomContributedThread = true;
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
 * The unread state of a single thread, or `null` when the thread has nothing unread to surface.
 */
type ThreadUnread = {
    /** The notification level derived from the server counts (or {@link NotificationLevel.Activity} for local-only unreads). */
    notificationLevel: NotificationLevel;
    /** Whether the homeserver reported a notification count for the thread (as opposed to a local-only unread). */
    hasServerNotifs: boolean;
    /** Whether the thread belongs in "My threads": the user participated, or was mentioned/keyword-matched. */
    isRelevantToMe: boolean;
};

/**
 * Evaluate a single thread's unread state, preferring the homeserver's notification
 * counts and falling back to local timeline inspection for threads the server hasn't
 * pushed counts for.
 *
 * TODO: {@link doesTimelineHaveUnreadMessages} reports a thread as unread when we replied
 * but aren't the *literal* last sender, so we guard it with {@link hasUnreadAfterMyLatestReply}.
 * That guard belongs in `doesTimelineHaveUnreadMessages` itself: see
 * https://github.com/element-hq/element-web/issues/34904, fixed by
 * https://github.com/element-hq/element-web/pull/34905. Drop the guard once that lands.
 *
 * @returns the thread's unread state, or `null` when there is nothing unread to surface.
 */
function evaluateThreadUnread(client: MatrixClient, room: Room, thread: Thread): ThreadUnread | null {
    // Primary signal: server-reported notification counts (authoritative).
    const highlight = room.getThreadUnreadNotificationCount(thread.id, NotificationCountType.Highlight);
    const total = room.getThreadUnreadNotificationCount(thread.id, NotificationCountType.Total);
    const hasServerNotifs = highlight > 0 || total > 0;

    // Fallback: local timeline inspection, computed lazily (skip when the server already gave us a signal).
    const hasUnread =
        hasServerNotifs ||
        (doesTimelineHaveUnreadMessages(room, thread.events) && hasUnreadAfterMyLatestReply(client, thread));
    if (!hasUnread) return null;

    const notificationLevel =
        highlight > 0
            ? NotificationLevel.Highlight
            : total > 0
              ? NotificationLevel.Notification
              : NotificationLevel.Activity;

    return {
        notificationLevel,
        hasServerNotifs,
        isRelevantToMe:
            thread.hasCurrentUserParticipated || highlight > 0 || hasCurrentUserSentInThread(client, thread),
    };
}

/**
 * Whether the current user has sent a reply in the thread's local timeline.
 *
 * {@link Thread.hasCurrentUserParticipated} is derived solely from the homeserver's
 * bundled `current_user_participated` flag, which is only refreshed when the server
 * re-sends the root event's aggregated relation. Immediately after the user replies
 * (e.g. Bob answering in a thread Alice started) that flag is still stale (`false`),
 * so the thread would wrongly land in "Other threads". We complement it by inspecting
 * the local timeline: if we've sent a reply in the thread, it's ours.
 *
 * We only count successfully-sent `m.thread` replies (not reactions, edits, or
 * failed/pending local echoes) to match the server's `current_user_participated`
 * semantics — the same `isRelation(THREAD_RELATION_TYPE.name) && !status` test the
 * rest of the app uses to identify a real thread reply.
 *
 * TODO: this is a workaround for https://github.com/matrix-org/matrix-js-sdk/issues/5515,
 * fixed upstream by https://github.com/matrix-org/matrix-js-sdk/pull/5516. Drop this helper
 * in favour of {@link Thread.hasCurrentUserParticipated} once that lands and we bump the pin.
 *
 * @returns true if the current user authored a reply in the thread.
 */
function hasCurrentUserSentInThread(client: MatrixClient, thread: Thread): boolean {
    const myUserId = client.getSafeUserId();
    return thread.events.some(
        (event) => event.getSender() === myUserId && event.isRelation(THREAD_RELATION_TYPE.name) && !event.status,
    );
}

/**
 * Whether a thread has an incoming (from someone other than us) unread-triggering
 * message that is newer than any reply we've sent.
 *
 * This closes a false positive in {@link doesTimelineHaveUnreadMessages}: because
 * our own events never trigger an unread count, its "latest important event" is the
 * newest message *from someone else*. The js-sdk only treats the thread as read
 * past our receipt when we sent the very last event, so if a later reaction/edit
 * (or any event that doesn't trigger an unread count) landed after our reply, that
 * older incoming message still reads as unread even though we've clearly seen it.
 *
 * We consider the thread read once our most recent reply is at/after the latest
 * incoming message. If there is no incoming message at all, there is nothing for us
 * to read, so it is not unread either.
 *
 * @returns true if there is an incoming message newer than our latest reply.
 */
function hasUnreadAfterMyLatestReply(client: MatrixClient, thread: Thread): boolean {
    const myUserId = client.getSafeUserId();

    let latestIncomingTs = -1;
    let myLatestTs = -1;
    for (const event of thread.events) {
        const ts = event.getTs();
        if (event.getSender() === myUserId) {
            if (ts > myLatestTs) myLatestTs = ts;
        } else if (eventTriggersUnreadCount(client, event) && ts > latestIncomingTs) {
            latestIncomingTs = ts;
        }
    }

    // No incoming unread-triggering message: nothing for us to read.
    if (latestIncomingTs === -1) return false;
    // Unread only if the latest incoming message is newer than our latest reply.
    return latestIncomingTs > myLatestTs;
}

/**
 * Store the room and its thread notification level
 */
type RoomData = UnreadThreadRooms["rooms"][0];

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

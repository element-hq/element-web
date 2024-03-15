/*
 *
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * /
 */

import { useCallback, useEffect, useState } from "react";
import { ClientEvent, MatrixClient, MatrixEventEvent, Room } from "matrix-js-sdk/src/matrix";
import { throttle } from "lodash";

import { doesRoomHaveUnreadThreads } from "../../../../Unread";
import { NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import { getThreadNotificationLevel } from "../../../../utils/notifications";
import { useSettingValue } from "../../../../hooks/useSettings";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { useEventEmitter } from "../../../../hooks/useEventEmitter";
import { VisibilityProvider } from "../../../../stores/room-list/filters/VisibilityProvider";

const MIN_UPDATE_INTERVAL_MS = 500;

type Result = {
    greatestNotificationLevel: NotificationLevel;
    rooms: Array<{ room: Room; notificationLevel: NotificationLevel }>;
};

/**
 * Return the greatest notification level of all thread, the list of rooms with unread threads, and their notification level.
 * The result is computed when the client syncs, or when forceComputation is true
 * @param forceComputation
 * @returns {Result}
 */
export function useUnreadThreadRooms(forceComputation: boolean): Result {
    const msc3946ProcessDynamicPredecessor = useSettingValue<boolean>("feature_dynamic_room_predecessors");
    const mxClient = useMatrixClientContext();

    const [result, setResult] = useState<Result>({ greatestNotificationLevel: NotificationLevel.None, rooms: [] });

    const doUpdate = useCallback(() => {
        setResult(computeUnreadThreadRooms(mxClient, msc3946ProcessDynamicPredecessor));
    }, [mxClient, msc3946ProcessDynamicPredecessor]);

    // The exhautive deps lint rule can't compute dependencies here since it's not a plain inline func.
    // We make this as simple as possible so its only dep is doUpdate itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const scheduleUpdate = useCallback(
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
 * @param mxClient - MatrixClient
 * @param msc3946ProcessDynamicPredecessor
 */
function computeUnreadThreadRooms(mxClient: MatrixClient, msc3946ProcessDynamicPredecessor: boolean): Result {
    // Only count visible rooms to not torment the user with notification counts in rooms they can't see.
    // This will include highlights from the previous version of the room internally
    const visibleRooms = mxClient.getVisibleRooms(msc3946ProcessDynamicPredecessor);

    let greatestNotificationLevel = NotificationLevel.None;
    const rooms: Result["rooms"] = [];

    for (const room of visibleRooms) {
        // We only care about rooms with unread threads
        if (VisibilityProvider.instance.isRoomVisible(room) && doesRoomHaveUnreadThreads(room)) {
            // Get the greatest notification level of all threads
            const notificationLevel = getThreadNotificationLevel(room);

            // If the room has an activity notification or less, we ignore it
            if (notificationLevel <= NotificationLevel.Activity) {
                continue;
            }

            if (notificationLevel > greatestNotificationLevel) {
                greatestNotificationLevel = notificationLevel;
            }

            rooms.push({ room, notificationLevel });
        }
    }

    const sortedRooms = rooms.sort((a, b) => sortRoom(a, b));
    return { greatestNotificationLevel, rooms: sortedRooms };
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

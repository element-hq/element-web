/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { NotificationCountType, Room, RoomEvent, ThreadEvent } from "matrix-js-sdk/src/matrix";
import { useCallback, useEffect, useState } from "react";

import { NotificationLevel } from "../../stores/notifications/NotificationLevel";
import { doesRoomOrThreadHaveUnreadMessages } from "../../Unread";
import { useEventEmitter } from "../useEventEmitter";

/**
 * Tracks the thread unread state for an entire room
 * @param room the room to track
 * @returns the type of notification for this room
 */
export const useRoomThreadNotifications = (room: Room): NotificationLevel => {
    const [notificationLevel, setNotificationLevel] = useState(NotificationLevel.None);

    const updateNotification = useCallback(() => {
        switch (room?.threadsAggregateNotificationType) {
            case NotificationCountType.Highlight:
                setNotificationLevel(NotificationLevel.Highlight);
                return;
            case NotificationCountType.Total:
                setNotificationLevel(NotificationLevel.Notification);
                return;
        }
        // We don't have any notified messages, but we might have unread messages. Let's
        // find out.
        for (const thread of room!.getThreads()) {
            // If the current thread has unread messages, we're done.
            if (doesRoomOrThreadHaveUnreadMessages(thread)) {
                setNotificationLevel(NotificationLevel.Activity);
                return;
            }
        }

        // default case
        setNotificationLevel(NotificationLevel.None);
    }, [room]);

    useEventEmitter(room, RoomEvent.UnreadNotifications, updateNotification);
    useEventEmitter(room, RoomEvent.Receipt, updateNotification);
    useEventEmitter(room, RoomEvent.Timeline, updateNotification);
    useEventEmitter(room, RoomEvent.Redaction, updateNotification);
    useEventEmitter(room, RoomEvent.LocalEchoUpdated, updateNotification);
    useEventEmitter(room, RoomEvent.MyMembership, updateNotification);
    useEventEmitter(room, ThreadEvent.New, updateNotification);
    useEventEmitter(room, ThreadEvent.Update, updateNotification);

    // Compute the notification once when mouting a room
    useEffect(() => {
        updateNotification();
    }, [updateNotification]);

    return notificationLevel;
};

/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { NotificationCountType, type Room, RoomEvent, ThreadEvent } from "matrix-js-sdk/src/matrix";
import { useCallback, useEffect, useState } from "react";

import { NotificationLevel } from "../../stores/notifications/NotificationLevel";
import { doesRoomHaveUnreadThreads } from "../../Unread";
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
        if (doesRoomHaveUnreadThreads(room)) {
            setNotificationLevel(NotificationLevel.Activity);
            return;
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

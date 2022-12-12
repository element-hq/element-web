/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { NotificationCount, NotificationCountType, Room, RoomEvent } from "matrix-js-sdk/src/models/room";
import { useCallback, useEffect, useState } from "react";

import { getUnsentMessages } from "../components/structures/RoomStatusBar";
import { getRoomNotifsState, getUnreadNotificationCount, RoomNotifState } from "../RoomNotifs";
import { NotificationColor } from "../stores/notifications/NotificationColor";
import { doesRoomHaveUnreadMessages } from "../Unread";
import { EffectiveMembership, getEffectiveMembership } from "../utils/membership";
import { useEventEmitter } from "./useEventEmitter";

export const useUnreadNotifications = (
    room: Room,
    threadId?: string,
): {
    symbol: string | null;
    count: number;
    color: NotificationColor;
} => {
    const [symbol, setSymbol] = useState<string | null>(null);
    const [count, setCount] = useState<number>(0);
    const [color, setColor] = useState<NotificationColor>(0);

    useEventEmitter(
        room,
        RoomEvent.UnreadNotifications,
        (unreadNotifications: NotificationCount, evtThreadId?: string) => {
            // Discarding all events not related to the thread if one has been setup
            if (threadId && threadId !== evtThreadId) return;
            updateNotificationState();
        },
    );
    useEventEmitter(room, RoomEvent.Receipt, () => updateNotificationState());
    useEventEmitter(room, RoomEvent.Timeline, () => updateNotificationState());
    useEventEmitter(room, RoomEvent.Redaction, () => updateNotificationState());
    useEventEmitter(room, RoomEvent.LocalEchoUpdated, () => updateNotificationState());
    useEventEmitter(room, RoomEvent.MyMembership, () => updateNotificationState());

    const updateNotificationState = useCallback(() => {
        if (getUnsentMessages(room, threadId).length > 0) {
            setSymbol("!");
            setCount(1);
            setColor(NotificationColor.Unsent);
        } else if (getEffectiveMembership(room.getMyMembership()) === EffectiveMembership.Invite) {
            setSymbol("!");
            setCount(1);
            setColor(NotificationColor.Red);
        } else if (getRoomNotifsState(room.client, room.roomId) === RoomNotifState.Mute) {
            setSymbol(null);
            setCount(0);
            setColor(NotificationColor.None);
        } else {
            const redNotifs = getUnreadNotificationCount(room, NotificationCountType.Highlight, threadId);
            const greyNotifs = getUnreadNotificationCount(room, NotificationCountType.Total, threadId);

            const trueCount = greyNotifs || redNotifs;
            setCount(trueCount);
            setSymbol(null);
            if (redNotifs > 0) {
                setColor(NotificationColor.Red);
            } else if (greyNotifs > 0) {
                setColor(NotificationColor.Grey);
            } else if (!threadId) {
                // TODO: No support for `Bold` on threads at the moment

                // We don't have any notified messages, but we might have unread messages. Let's
                // find out.
                const hasUnread = doesRoomHaveUnreadMessages(room);
                setColor(hasUnread ? NotificationColor.Bold : NotificationColor.None);
            }
        }
    }, [room, threadId]);

    useEffect(() => {
        updateNotificationState();
    }, [updateNotificationState]);

    return {
        symbol,
        count,
        color,
    };
};

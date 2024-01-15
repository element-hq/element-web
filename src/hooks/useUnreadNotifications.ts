/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

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

import { RoomEvent } from "matrix-js-sdk/src/matrix";
import { useCallback, useEffect, useState } from "react";

import type { NotificationCount, Room } from "matrix-js-sdk/src/matrix";
import { determineUnreadState } from "../RoomNotifs";
import { NotificationLevel } from "../stores/notifications/NotificationLevel";
import { useEventEmitter } from "./useEventEmitter";

export const useUnreadNotifications = (
    room?: Room,
    threadId?: string,
): {
    symbol: string | null;
    count: number;
    level: NotificationLevel;
} => {
    const [symbol, setSymbol] = useState<string | null>(null);
    const [count, setCount] = useState<number>(0);
    const [level, setLevel] = useState<NotificationLevel>(NotificationLevel.None);

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
        const { symbol, count, level } = determineUnreadState(room, threadId);
        setSymbol(symbol);
        setCount(count);
        setLevel(level);
    }, [room, threadId]);

    useEffect(() => {
        updateNotificationState();
    }, [updateNotificationState]);

    return {
        symbol,
        count,
        level,
    };
};

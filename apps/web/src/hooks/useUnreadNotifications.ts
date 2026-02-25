/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
        const { symbol, count, level } = determineUnreadState(room, threadId, false);
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

/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import React, { useMemo } from "react";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { NotificationDecoration } from "@element-hq/web-shared-components";

import type { Room } from "matrix-js-sdk/src/matrix";
import { RoomNotificationStateStore } from "../../stores/notifications/RoomNotificationStateStore";
import { useCall } from "../../hooks/useCall";
import { useTypedEventEmitterState } from "../../hooks/useEventEmitter";
import { NotificationStateEvents } from "../../stores/notifications/NotificationState";

export interface ModuleNotificationDecorationProps {
    /**
     * The room for which the decoration is rendered.
     */
    room: Room;
}

/**
 * React component that takes a room as prop and renders {@link NotificationDecoration} with it.
 * Used by the module API to render notification decoration without having to expose a bunch of stores.
 */
export const ModuleNotificationDecoration: React.FC<ModuleNotificationDecorationProps> = ({ room }) => {
    const notificationState = useMemo(() => RoomNotificationStateStore.instance.getRoomState(room), [room]);
    const call = useCall(room.roomId);

    // Subscribe to notification state changes
    const notificationData = useTypedEventEmitterState(notificationState, NotificationStateEvents.Update, () => ({
        hasAnyNotificationOrActivity: notificationState.hasAnyNotificationOrActivity,
        isUnsentMessage: notificationState.isUnsentMessage,
        invited: notificationState.invited,
        isMention: notificationState.isMention,
        isActivityNotification: notificationState.isActivityNotification,
        isNotification: notificationState.isNotification,
        hasUnreadCount: notificationState.hasUnreadCount,
        count: notificationState.count,
        muted: notificationState.muted,
    }));

    // Convert CallType enum to string
    const callType =
        call?.callType === CallType.Video ? "video" : call?.callType === CallType.Voice ? "voice" : undefined;

    return <NotificationDecoration {...notificationData} callType={callType} />;
};

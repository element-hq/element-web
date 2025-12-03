/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import React, { useMemo } from "react";

import type { Room } from "matrix-js-sdk/src/matrix";
import { RoomNotificationStateStore } from "../../stores/notifications/RoomNotificationStateStore";
import { useCall, useParticipantCount } from "../../hooks/useCall";
import { NotificationDecoration } from "../../components/views/rooms/NotificationDecoration";

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
    const hasParticipantInCall = useParticipantCount(call) > 0;
    return <NotificationDecoration notificationState={notificationState} hasVideoCall={hasParticipantInCall} />;
};

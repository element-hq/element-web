/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import { useNotificationDecorationViewModel } from "../../../viewmodels/notification_decoration/NotificationDecorationViewModel";
import { NotificationDecoration } from "./NotificationDecoration";

interface NotificationDecorationViewProps {
    /**
     * The room to display the decoration for.
     */
    room: Room;
    /**
     * The thread ID to display the decoration for.
     */
    threadId?: string;
}

/**
 * Displays the notification decoration for a room or a thread.
 */
export function NotificationDecorationView({ room, threadId }: NotificationDecorationViewProps): JSX.Element | null {
    const vm = useNotificationDecorationViewModel(room, threadId);

    return <NotificationDecoration vm={vm} />;
}

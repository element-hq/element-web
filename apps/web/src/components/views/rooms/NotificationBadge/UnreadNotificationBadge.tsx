/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";
import React, { type JSX, useEffect } from "react";
import { NotificationBadgeView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { UnreadNotificationBadgeViewModel } from "../../../../viewmodels/room/notification-badge/UnreadNotificationBadgeViewModel";

interface Props {
    room?: Room;
    threadId?: string;
    /**
     * If true, where we would normally show a badge, we instead show a dot. No numeric count will
     * be displayed.
     */
    forceDot?: boolean;
}

export function UnreadNotificationBadge({ room, threadId, forceDot }: Props): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new UnreadNotificationBadgeViewModel({
                room,
                threadId,
                forceDot,
            }),
    );

    useEffect(() => {
        vm.setRoom(room);
    }, [room, vm]);

    useEffect(() => {
        vm.setThreadId(threadId);
    }, [threadId, vm]);

    useEffect(() => {
        vm.setForceDot(forceDot);
    }, [forceDot, vm]);

    return <NotificationBadgeView vm={vm} />;
}

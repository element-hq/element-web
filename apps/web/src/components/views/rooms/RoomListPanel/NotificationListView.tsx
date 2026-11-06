/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, type JSX, type ReactNode } from "react";
import {
    NotificationListView as SharedNotificationListView,
    useCreateAutoDisposedViewModel,
} from "@element-hq/web-shared-components";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { DecoratedRoomAvatarView } from "../../avatars/DecoratedRoomAvatarView";
import { NotificationListViewModel } from "../../../../viewmodels/notifications/NotificationListViewModel";

/**
 * The notification list, displayed in the left panel instead of the room list.
 */
export function NotificationListView(): JSX.Element {
    const client = useMatrixClientContext();
    const vm = useCreateAutoDisposedViewModel(() => new NotificationListViewModel({ client }));

    const renderAvatar = useCallback(
        (roomId: string): ReactNode => {
            const room = client.getRoom(roomId);
            return room ? <DecoratedRoomAvatarView room={room} /> : null;
        },
        [client],
    );

    return <SharedNotificationListView vm={vm} renderAvatar={renderAvatar} />;
}

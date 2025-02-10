/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";
import React from "react";

import { useUnreadNotifications } from "../../../../hooks/useUnreadNotifications";
import { StatelessNotificationBadge } from "./StatelessNotificationBadge";

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
    const { symbol, count, level } = useUnreadNotifications(room, threadId);

    return <StatelessNotificationBadge symbol={symbol} count={count} level={level} forceDot={forceDot} />;
}

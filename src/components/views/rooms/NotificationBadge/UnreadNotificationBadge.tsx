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

import { Room } from "matrix-js-sdk/src/matrix";
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

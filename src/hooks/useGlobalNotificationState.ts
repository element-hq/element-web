/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useState } from "react";

import { type SummarizedNotificationState } from "../stores/notifications/SummarizedNotificationState";
import {
    RoomNotificationStateStore,
    UPDATE_STATUS_INDICATOR,
} from "../stores/notifications/RoomNotificationStateStore";
import { useEventEmitter } from "./useEventEmitter";

/**
 * Tracks the global notification state of the user's account
 * @returns A global notification state object
 */
export const useGlobalNotificationState = (): SummarizedNotificationState => {
    const [summarizedNotificationState, setSummarizedNotificationState] = useState(
        RoomNotificationStateStore.instance.globalState,
    );

    useEventEmitter(
        RoomNotificationStateStore.instance,
        UPDATE_STATUS_INDICATOR,
        (notificationState: SummarizedNotificationState) => {
            setSummarizedNotificationState(notificationState);
        },
    );

    return summarizedNotificationState;
};

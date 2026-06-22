/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useContext, useState } from "react";

import { type SummarizedNotificationState } from "../stores/notifications/SummarizedNotificationState";
import { UPDATE_STATUS_INDICATOR } from "../stores/notifications/RoomNotificationStateStore";
import { useEventEmitter } from "./useEventEmitter";
import { SDKContext } from "../contexts/SDKContext.ts";

/**
 * Tracks the global notification state of the user's account
 * @returns A global notification state object
 */
export const useGlobalNotificationState = (): SummarizedNotificationState => {
    const sdkContext = useContext(SDKContext);
    const [summarizedNotificationState, setSummarizedNotificationState] = useState(
        sdkContext.roomNotificationStateStore.globalState,
    );

    useEventEmitter(
        sdkContext.roomNotificationStateStore,
        UPDATE_STATUS_INDICATOR,
        (notificationState: SummarizedNotificationState) => {
            setSummarizedNotificationState(notificationState);
        },
    );

    return summarizedNotificationState;
};

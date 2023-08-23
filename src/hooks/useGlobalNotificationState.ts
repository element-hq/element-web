/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { useState } from "react";

import { SummarizedNotificationState } from "../stores/notifications/SummarizedNotificationState";
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

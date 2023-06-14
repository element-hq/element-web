/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { useCallback, useMemo, useState } from "react";
import { Room } from "matrix-js-sdk/src/matrix";

import { RoomNotifState } from "../RoomNotifs";
import { EchoChamber } from "../stores/local-echo/EchoChamber";
import { PROPERTY_UPDATED } from "../stores/local-echo/GenericEchoChamber";
import { CachedRoomKey } from "../stores/local-echo/RoomEchoChamber";
import { useEventEmitter } from "./useEventEmitter";

export const useNotificationState = (room: Room): [RoomNotifState | undefined, (state: RoomNotifState) => void] => {
    const echoChamber = useMemo(() => EchoChamber.forRoom(room), [room]);
    const [notificationState, setNotificationState] = useState<RoomNotifState | undefined>(
        echoChamber.notificationVolume,
    );
    useEventEmitter(echoChamber, PROPERTY_UPDATED, (key: CachedRoomKey) => {
        if (key === CachedRoomKey.NotificationVolume && echoChamber.notificationVolume !== undefined) {
            setNotificationState(echoChamber.notificationVolume);
        }
    });
    const setter = useCallback((state: RoomNotifState) => (echoChamber.notificationVolume = state), [echoChamber]);
    return [notificationState, setter];
};

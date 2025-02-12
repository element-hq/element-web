/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useMemo, useState } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import { type RoomNotifState } from "../RoomNotifs";
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
    // eslint-disable-next-line react-compiler/react-compiler
    const setter = useCallback((state: RoomNotifState) => (echoChamber.notificationVolume = state), [echoChamber]);
    return [notificationState, setter];
};

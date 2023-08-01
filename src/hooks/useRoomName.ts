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

import { Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { useEffect, useState } from "react";

import { IOOBData } from "../stores/ThreepidInviteStore";
import { useTypedEventEmitter } from "./useEventEmitter";
import { _t } from "../languageHandler";

const getRoomName = (room?: Room, oobName = ""): string => room?.name || oobName;

/**
 * Determines the room name from a combination of the room model and potential
 * out-of-band information
 * @param room - The room model
 * @param oobData - out-of-band information about the room
 * @returns {string} the room name
 */
export function useRoomName(room?: Room, oobData?: IOOBData): string {
    let oobName = _t("Join Room");
    if (oobData && oobData.name) {
        oobName = oobData.name;
    }

    const [name, setName] = useState<string>(getRoomName(room, oobName));

    useTypedEventEmitter(room, RoomEvent.Name, () => {
        setName(getRoomName(room, oobName));
    });

    useEffect(() => {
        setName(getRoomName(room, oobName));
    }, [room, oobName]);

    return name;
}

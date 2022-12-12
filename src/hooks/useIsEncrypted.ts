/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { useCallback, useState } from "react";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { EventType } from "matrix-js-sdk/src/@types/event";

import { useTypedEventEmitter } from "./useEventEmitter";

// Hook to simplify watching whether a Matrix room is encrypted, returns undefined if room is undefined
export function useIsEncrypted(cli: MatrixClient, room?: Room): boolean | undefined {
    const [isEncrypted, setIsEncrypted] = useState(room ? cli.isRoomEncrypted(room.roomId) : undefined);

    const update = useCallback(
        (event: MatrixEvent) => {
            if (room && event.getType() === EventType.RoomEncryption) {
                setIsEncrypted(cli.isRoomEncrypted(room.roomId));
            }
        },
        [cli, room],
    );
    useTypedEventEmitter(room?.currentState, RoomStateEvent.Events, update);

    return isEncrypted;
}

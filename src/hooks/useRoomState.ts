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

import { useCallback, useEffect, useState } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomState, RoomStateEvent } from "matrix-js-sdk/src/models/room-state";

import { useTypedEventEmitter } from "./useEventEmitter";

type Mapper<T> = (roomState: RoomState) => T;
const defaultMapper: Mapper<RoomState> = (roomState: RoomState) => roomState;

// Hook to simplify watching Matrix Room state
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
export const useRoomState = <T extends any = RoomState>(
    room?: Room,
    mapper: Mapper<T> = defaultMapper as Mapper<T>,
): T => {
    const [value, setValue] = useState<T>(room ? mapper(room.currentState) : (undefined as T));

    const update = useCallback(() => {
        if (!room) return;
        setValue(mapper(room.currentState));
    }, [room, mapper]);

    useTypedEventEmitter(room?.currentState, RoomStateEvent.Update, update);
    useEffect(() => {
        update();
        return () => {
            setValue(room ? mapper(room.currentState) : (undefined as T));
        };
    }, [room, mapper, update]);
    return value;
};

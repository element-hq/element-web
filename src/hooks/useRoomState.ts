/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useEffect, useRef, useState } from "react";
import { type Room, type RoomState, RoomStateEvent } from "matrix-js-sdk/src/matrix";

import { useTypedEventEmitter } from "./useEventEmitter";

type Mapper<T> = (roomState: RoomState) => T;
const defaultMapper: Mapper<RoomState> = (roomState: RoomState) => roomState;

// Hook to simplify watching Matrix Room state
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
export const useRoomState = <T extends any = RoomState>(
    room?: Room,
    mapper: Mapper<T> = defaultMapper as Mapper<T>,
): T => {
    // Create a ref that stores mapper
    const savedMapper = useRef(mapper);

    // Update ref.current value if mapper changes.
    useEffect(() => {
        savedMapper.current = mapper;
    }, [mapper]);

    const [value, setValue] = useState<T>(room ? mapper(room.currentState) : (undefined as T));

    const update = useCallback(() => {
        if (!room) return;
        setValue(savedMapper.current(room.currentState));
    }, [room]);

    useTypedEventEmitter(room?.currentState, RoomStateEvent.Update, update);
    useEffect(() => {
        update();
        return () => {
            setValue(room ? savedMapper.current(room.currentState) : (undefined as T));
        };
    }, [room, update]);
    return value;
};

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

/**
 * A hook to watch the state of a room.
 *
 * Call `useRoomState` in a component to watch the state of a room.
 *
 * A mapper function must be provided to process the room state into outputs suitable for the component. The mapper
 * function will be called whenever the room state changes.
 *
 * @example
 * ```
 * function MyComponent({room}: Props): JSX.Element {
 *   const { historyVisibility, joinRule } = useRoomState(room, state => ({
 *      historyVisibility: state.getHistoryVisibility(),
 *      joinRule: state.getJoinRule(),
 *   }));
 *   // ...
 * ```
 *
 * @param room - The room to watch. If this is undefined, the returned value will also be undefined.
 * @param mapper - A function to process the room state into outputs suitable for the component.
 * @returns The output of `mapper`, or `undefined` if `room` is undefined.
 */
export function useRoomState<T>(room: Room, mapper: Mapper<T>): T;
export function useRoomState<T>(room: Room | undefined, mapper: Mapper<T>): T | undefined;
export function useRoomState<T>(room: Room | undefined, mapper: Mapper<T>): T | undefined {
    // Create a ref that stores mapper
    const savedMapper = useRef(mapper);

    // Update ref.current value if mapper changes.
    useEffect(() => {
        savedMapper.current = mapper;
    }, [mapper]);

    const [value, setValue] = useState<T | undefined>(room ? mapper(room.currentState) : undefined);

    const update = useCallback(() => {
        if (!room) return;
        setValue(savedMapper.current(room.currentState));
    }, [room]);

    useTypedEventEmitter(room?.currentState, RoomStateEvent.Update, update);
    useEffect(() => {
        update();
        return () => {
            setValue(room ? savedMapper.current(room.currentState) : undefined);
        };
    }, [room, update]);
    return value;
}

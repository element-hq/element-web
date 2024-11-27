/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";
import React, { ContextType, createContext, memo, ReactNode, useContext, useEffect, useRef, useState } from "react";

import { objectKeyChanges } from "../utils/objects.ts";
import { useTypedEventEmitter } from "../hooks/useEventEmitter.ts";
import RoomContext from "./RoomContext.ts";

type ContextValue = ContextType<typeof RoomContext>;

export enum NotificationStateEvents {
    Update = "update",
}

type EventHandlerMap<C extends Record<string, any>> = {
    [NotificationStateEvents.Update]: (keys: Array<keyof C>) => void;
};

class EfficientContext<C extends Record<string, any>> extends TypedEventEmitter<
    NotificationStateEvents,
    EventHandlerMap<C>
> {
    public state?: C;

    public setState(state: C): void {
        const changedKeys = objectKeyChanges(this.state ?? ({} as C), state);
        this.state = state;
        this.emit(NotificationStateEvents.Update, changedKeys);
    }
}

const ScopedRoomContext = createContext<EfficientContext<ContextValue> | undefined>(undefined);

// Uses react memo and leverages splatting the value to ensure that the context is only updated when the state changes (shallow compare)
export const ScopedRoomContextProvider = memo(
    ({ children, ...state }: { children: ReactNode } & ContextValue): JSX.Element => {
        const contextRef = useRef(new EfficientContext<ContextValue>());
        useEffect(() => {
            contextRef.current.setState(state);
        }, [state]);

        // Includes the legacy RoomContext provider for backwards compatibility with class components
        return (
            <RoomContext.Provider value={state}>
                <ScopedRoomContext.Provider value={contextRef.current}>{children}</ScopedRoomContext.Provider>
            </RoomContext.Provider>
        );
    },
);

export function useScopedRoomContext<K extends Array<keyof ContextValue>>(
    ...keys: K
): { [key in K[number]]: ContextValue[key] } {
    const context = useContext(ScopedRoomContext);
    const [state, setState] = useState<{ [key in K[number]]: ContextValue[key] }>({} as any);

    useTypedEventEmitter(context, NotificationStateEvents.Update, (updatedKeys: K[]): void => {
        if (context?.state && updatedKeys.some((updatedKey) => keys.includes(updatedKey as any))) {
            setState(context.state);
        }
    });

    return state;
}

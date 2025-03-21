/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";
import React, {
    type JSX,
    type ContextType,
    createContext,
    memo,
    type ReactNode,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { objectKeyChanges } from "../utils/objects.ts";
import { useTypedEventEmitter } from "../hooks/useEventEmitter.ts";
import RoomContext from "./RoomContext.ts";

// React Contexts with frequently changing values (like State where the object reference is changed on every update)
// cause performance issues by triggering a re-render on every component subscribed to that context.
// With ScopedRoomContext we're effectively setting up virtual contexts which are a subset of the overall context object
// and subscribers specify which fields they care about, and they will only be awoken on updates to those specific fields.

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
    public constructor(public state: C) {
        super();
    }

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
        // eslint-disable-next-line react-compiler/react-compiler,react-hooks/exhaustive-deps
        const context = useMemo(() => new EfficientContext<ContextValue>(state), []);
        useEffect(() => {
            context.setState(state);
        }, [context, state]);

        // Includes the legacy RoomContext provider for backwards compatibility with class components
        return (
            <RoomContext.Provider value={state}>
                <ScopedRoomContext.Provider value={context}>{children}</ScopedRoomContext.Provider>
            </RoomContext.Provider>
        );
    },
);

type ScopedRoomContext<K extends Array<keyof ContextValue>> = { [key in K[number]]: ContextValue[key] };

export function useScopedRoomContext<K extends Array<keyof ContextValue>>(...keys: K): ScopedRoomContext<K> {
    const context = useContext(ScopedRoomContext);
    const [state, setState] = useState<ScopedRoomContext<K>>(context?.state ?? ({} as ScopedRoomContext<K>));

    useTypedEventEmitter(context, NotificationStateEvents.Update, (updatedKeys: K): void => {
        if (context?.state && updatedKeys.some((updatedKey) => keys.includes(updatedKey))) {
            setState(context.state);
        }
    });

    return state;
}

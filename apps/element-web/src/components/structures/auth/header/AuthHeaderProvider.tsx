/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { isEqual } from "lodash";
import React, { type JSX, type ComponentProps, type PropsWithChildren, type Reducer, useReducer } from "react";

import { AuthHeaderContext } from "./AuthHeaderContext";
import { type AuthHeaderModifier } from "./AuthHeaderModifier";

export enum AuthHeaderActionType {
    Add,
    Remove,
}

interface AuthHeaderAction {
    type: AuthHeaderActionType;
    value: ComponentProps<typeof AuthHeaderModifier>;
}

export type AuthHeaderReducer = Reducer<ComponentProps<typeof AuthHeaderModifier>[], AuthHeaderAction>;

export function AuthHeaderProvider({ children }: PropsWithChildren): JSX.Element {
    const [state, dispatch] = useReducer<ComponentProps<typeof AuthHeaderModifier>[], [AuthHeaderAction]>(
        (state: ComponentProps<typeof AuthHeaderModifier>[], action: AuthHeaderAction) => {
            switch (action.type) {
                case AuthHeaderActionType.Add:
                    return [action.value, ...state];
                case AuthHeaderActionType.Remove:
                    return state.length && isEqual(state[0], action.value) ? state.slice(1) : state;
            }
        },
        [] as ComponentProps<typeof AuthHeaderModifier>[],
    );
    return <AuthHeaderContext.Provider value={{ state, dispatch }}>{children}</AuthHeaderContext.Provider>;
}

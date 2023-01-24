/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { isEqual } from "lodash";
import React, { ComponentProps, PropsWithChildren, Reducer, useReducer } from "react";

import { AuthHeaderContext } from "./AuthHeaderContext";
import { AuthHeaderModifier } from "./AuthHeaderModifier";

export enum AuthHeaderActionType {
    Add,
    Remove,
}

interface AuthHeaderAction {
    type: AuthHeaderActionType;
    value: ComponentProps<typeof AuthHeaderModifier>;
}

export type AuthHeaderReducer = Reducer<ComponentProps<typeof AuthHeaderModifier>[], AuthHeaderAction>;

export function AuthHeaderProvider({ children }: PropsWithChildren<{}>): JSX.Element {
    const [state, dispatch] = useReducer<AuthHeaderReducer>(
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

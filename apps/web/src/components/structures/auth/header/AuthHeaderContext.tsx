/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { createContext, type Dispatch, type Reducer, type ReducerState } from "react";

import type { AuthHeaderReducer } from "./AuthHeaderProvider";

type ReducerAction<R extends Reducer<any, any>> = R extends Reducer<any, infer A> ? A : never;

interface AuthHeaderContextType {
    state: ReducerState<AuthHeaderReducer>;
    dispatch: Dispatch<ReducerAction<AuthHeaderReducer>>;
}

export const AuthHeaderContext = createContext<AuthHeaderContextType | undefined>(undefined);

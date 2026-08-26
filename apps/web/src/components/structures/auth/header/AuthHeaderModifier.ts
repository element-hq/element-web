/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ReactNode, useContext, useEffect } from "react";

import { AuthHeaderContext } from "./AuthHeaderContext";
import { AuthHeaderActionType } from "./AuthHeaderProvider";

interface Props {
    title: ReactNode;
    icon?: ReactNode;
    hideServerPicker?: boolean;
}

export function AuthHeaderModifier(props: Props): null {
    const context = useContext(AuthHeaderContext);
    const dispatch = context?.dispatch ?? null;
    useEffect(() => {
        if (!dispatch) {
            return;
        }
        dispatch({ type: AuthHeaderActionType.Add, value: props });
        return () => dispatch({ type: AuthHeaderActionType.Remove, value: props });
    }, [props, dispatch]);
    return null;
}

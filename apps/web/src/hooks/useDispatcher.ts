/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useEffectEvent } from "react";

import { type ActionPayload } from "../dispatcher/payloads";
import { type MatrixDispatcher } from "../dispatcher/dispatcher";

// Hook to simplify listening to event dispatches
export const useDispatcher = (dispatcher: MatrixDispatcher, handler: (payload: ActionPayload) => void): void => {
    const onDispatch = useEffectEvent(handler);

    useEffect(() => {
        const ref = dispatcher.register(onDispatch);
        return () => {
            dispatcher.unregister(ref);
        };
    }, [dispatcher]);
};

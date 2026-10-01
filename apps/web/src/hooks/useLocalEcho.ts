/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useState } from "react";

export const useLocalEcho = <T, V extends T = T>(
    currentFactory: () => T,
    setterFn: (value: V) => Promise<unknown>,
    errorFn: (error: unknown) => void,
): [value: T, handler: (value: V) => void] => {
    const [value, setValue] = useState(currentFactory);
    const handler = async (value: V): Promise<void> => {
        setValue(value);
        try {
            await setterFn(value);
        } catch (e) {
            setValue(currentFactory());
            errorFn(e);
        }
    };

    return [value, handler];
};

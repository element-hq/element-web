/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Dispatch, useState } from "react";

// Hook to simplify interactions with a store-backed state values
// Returns value and method to change the state value
export const useStateCallback = <T>(initialValue: T, callback: (v: T) => void): [T, Dispatch<T>] => {
    const [value, setValue] = useState(initialValue);
    const interceptSetValue = (newVal: T): void => {
        setValue(newVal);
        callback(newVal);
    };
    return [value, interceptSetValue];
};

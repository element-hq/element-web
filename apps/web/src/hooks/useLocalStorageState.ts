/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Dispatch, useCallback, useEffect, useState } from "react";

const getValue = <T>(key: string, initialValue: T): T => {
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : initialValue;
    } catch {
        return initialValue;
    }
};

// Hook behaving like useState but persisting the value to localStorage. Returns same as useState
export const useLocalStorageState = <T>(key: string, initialValue: T): [T, Dispatch<T>] => {
    const lsKey = "mx_" + key;

    const [value, setValue] = useState<T>(getValue(lsKey, initialValue));

    useEffect(() => {
        setValue(getValue(lsKey, initialValue));
    }, [lsKey, initialValue]);

    const _setValue: Dispatch<T> = useCallback(
        (v: T) => {
            window.localStorage.setItem(lsKey, JSON.stringify(v));
            setValue(v);
        },
        [lsKey],
    );

    return [value, _setValue];
};

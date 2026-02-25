/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useState } from "react";

// Hook to simplify managing state of arrays of a common type
export const useStateArray = <T>(initialSize: number, initialState: T | T[]): [T[], (i: number, v: T) => void] => {
    const [data, setData] = useState<T[]>(() => {
        return Array.isArray(initialState) ? initialState : new Array(initialSize).fill(initialState);
    });
    return [
        data,
        (index: number, value: T) =>
            setData((data) => {
                const copy = [...data];
                copy[index] = value;
                return copy;
            }),
    ];
};

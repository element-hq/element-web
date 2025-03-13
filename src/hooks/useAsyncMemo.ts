/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useState, useEffect, type DependencyList } from "react";

type Fn<T> = () => Promise<T>;

export function useAsyncMemo<T>(fn: Fn<T>, deps: DependencyList, initialValue: T): T;
export function useAsyncMemo<T>(fn: Fn<T>, deps: DependencyList, initialValue?: T): T | undefined;
export function useAsyncMemo<T>(fn: Fn<T>, deps: DependencyList, initialValue?: T): T | undefined {
    const [value, setValue] = useState<T | undefined>(initialValue);
    useEffect(() => {
        let discard = false;
        fn().then((v) => {
            if (!discard) {
                setValue(v);
            }
        });
        return () => {
            discard = true;
        };
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps
    return value;
}

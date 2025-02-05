/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type DependencyList, useCallback, useEffect, useState } from "react";

type Fn<T> = () => Promise<T>;

/**
 * Works just like useMemo or our own useAsyncMemo, but additionally exposes a method to refresh the cached value
 * as if the dependency had changed
 * @param fn function to memoize
 * @param deps React hooks dependencies for the function
 * @param initialValue initial value
 * @return tuple of cached value and refresh callback
 */
export function useAsyncRefreshMemo<T>(fn: Fn<T>, deps: DependencyList, initialValue: T): [T, () => void];
export function useAsyncRefreshMemo<T>(fn: Fn<T>, deps: DependencyList, initialValue?: T): [T | undefined, () => void];
export function useAsyncRefreshMemo<T>(fn: Fn<T>, deps: DependencyList, initialValue?: T): [T | undefined, () => void] {
    const [value, setValue] = useState<T | undefined>(initialValue);
    const refresh = useCallback(() => {
        let discard = false;
        fn()
            .then((v) => {
                if (!discard) {
                    setValue(v);
                }
            })
            .catch((err) => console.error(err));
        return () => {
            discard = true;
        };
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps,react-compiler/react-compiler
    useEffect(refresh, [refresh]);
    return [value, refresh];
}

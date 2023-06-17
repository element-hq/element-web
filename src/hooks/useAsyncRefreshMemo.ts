/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { DependencyList, useCallback, useEffect, useState } from "react";

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
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(refresh, [refresh]);
    return [value, refresh];
}

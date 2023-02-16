/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { useState, useEffect, DependencyList } from "react";

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

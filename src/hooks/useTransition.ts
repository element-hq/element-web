/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

// Based on https://stackoverflow.com/a/61680184

import { DependencyList, useEffect, useRef } from "react";

export const useTransition = <D extends DependencyList>(callback: (...params: D) => void, deps: D): void => {
    const func = useRef<(...params: D) => void>(callback);

    useEffect(() => {
        func.current = callback;
    }, [callback]);

    const args = useRef<D | null>(null);

    useEffect(() => {
        if (args.current !== null) func.current(...args.current);
        args.current = deps;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
};

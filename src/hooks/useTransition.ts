/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Based on https://stackoverflow.com/a/61680184

import { type DependencyList, useEffect, useRef } from "react";

export const useTransition = <D extends DependencyList>(callback: (...params: D) => void, deps: D): void => {
    const func = useRef<(...params: D) => void>(callback);

    useEffect(() => {
        func.current = callback;
    }, [callback]);

    const args = useRef<D | null>(null);

    useEffect(() => {
        if (args.current !== null) func.current(...args.current);
        args.current = deps;
        // eslint-disable-next-line react-compiler/react-compiler,react-hooks/exhaustive-deps
    }, deps);
};

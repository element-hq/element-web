/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect } from "react";

const DEBOUNCE_TIMEOUT = 100;

export function useDebouncedCallback<T extends any[]>(
    enabled: boolean,
    callback: (...params: T) => unknown,
    params: T,
): void {
    useEffect(() => {
        let handle: number | null = null;
        const doSearch = (): void => {
            handle = null;
            callback(...params);
        };
        if (enabled !== false) {
            handle = window.setTimeout(doSearch, DEBOUNCE_TIMEOUT);
            return () => {
                if (handle) {
                    clearTimeout(handle);
                }
            };
        }
    }, [enabled, callback, params]);
}

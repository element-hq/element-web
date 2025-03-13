/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useRef } from "react";

/**
 * Hook to prevent a slower response to an earlier query overwriting the result to a faster response of a later query
 * @param onResultChanged
 */
export const useLatestResult = <T, R>(
    onResultChanged: (result: R) => void,
): [(query: T | null) => void, (query: T | null, result: R) => void] => {
    const ref = useRef<T | null>(null);
    const setQuery = useCallback((query: T | null) => {
        ref.current = query;
    }, []);
    const setResult = useCallback(
        (query: T | null, result: R) => {
            if (ref.current === query) {
                onResultChanged(result);
            }
        },
        [onResultChanged],
    );
    return [setQuery, setResult];
};

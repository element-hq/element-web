/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback } from "react";

/**
 * Combines multiple refs into a single ref callback.
 * @param refs - The refs to combine
 * @returns A ref callback that sets all provided refs to the same element
 */
export function useCombinedRef<T>(...refs: (React.Ref<T> | null)[]) {
    return useCallback((element: T | null) => {
        refs.forEach((ref) => {
            if (!ref) return;
            if (typeof ref === "function") ref(element);
            else (ref as React.MutableRefObject<T | null>).current = element;
        });
    }, refs);
}
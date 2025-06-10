/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useEffect, useRef, type RefObject, useState } from "react";

/**
 * A hook to check if the filter list is overflowing.
 * The list is overflowing if the scrollHeight is greater than `FILTER_HEIGHT`.
 */
export function useIsFilterOverflowing<T extends HTMLElement>(
    filterHeight: number,
): { ref: RefObject<T | undefined>; isOverflowing: boolean } {
    const ref = useRef<T>(undefined);
    const [isOverflowing, setIsOverflowing] = useState(false);

    useEffect(() => {
        if (!ref.current) return;

        const node = ref.current;
        const observer = new ResizeObserver(() => setIsOverflowing(node.scrollHeight > filterHeight));
        observer.observe(node);
        return () => observer.disconnect();
    }, [ref, filterHeight]);

    return { ref, isOverflowing };
}

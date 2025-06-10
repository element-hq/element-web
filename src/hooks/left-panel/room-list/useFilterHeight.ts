/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * A hook to get the height of the filter list.
 * @returns a ref that should be put on the filter button and its height.
 */
export function useFilterHeight<T extends HTMLElement>(): { filterHeight: number; filterRef: RefObject<T | null> } {
    const [filterHeight, setFilterHeight] = useState(0);
    const filterRef = useRef<T>(null);

    useEffect(() => {
        if (!filterRef.current) return;

        const setHeight = () => {
            const height = filterRef.current?.offsetHeight;
            if (height) setFilterHeight(height);
        };

        setHeight();
        const observer = new ResizeObserver(() => {
            setHeight();
        });
        observer.observe(filterRef.current);
        return () => observer.disconnect();
    }, [filterRef]);

    return { filterHeight, filterRef };
}

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * A hook to animate the filter list when it is expanded or not.
 * @param areFiltersExpanded
 * @param filterHeight
 */
export function useAnimateFilter<T extends HTMLElement>(
    areFiltersExpanded: boolean,
    filterHeight: number,
): { ref: RefObject<T | null>; isExpanded: boolean } {
    const ref = useRef<T | null>(null);
    useEffect(() => {
        if (!ref.current) return;

        // Round to 2 decimal places to avoid floating point precision issues
        const floor = (a: number): number => Math.floor(a * 100) / 100;
        // For the animation to work, we need `grid-template-rows` to have the same unit at the beginning and the end
        // If px is used at the beginning, we need to use px at the end.
        // In our case, we use fr unit to fully grow when expanded (1fr) so we need to compute the value in fr when the filters are not expanded
        const setRowHeight = (): void =>
            ref.current?.style.setProperty(
                "--row-height",
                `${floor(filterHeight / (ref?.current.scrollHeight || 1))}fr`,
            );
        setRowHeight();

        const observer = new ResizeObserver(() => {
            // Remove transition to avoid the animation to run when the new --row-height is not set yet
            // If the animation runs at this moment, the first row will jump
            ref.current?.style.setProperty("transition", "unset");
            setRowHeight();
        });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [ref, filterHeight]);

    // Put back the transition to the element when the expanded state changes
    // because we want to animate it
    const [isExpanded, setExpanded] = useState(areFiltersExpanded);
    useEffect(() => {
        ref.current?.style.setProperty("transition", "0.1s ease-in-out");
        setExpanded(areFiltersExpanded);
    }, [areFiltersExpanded, ref]);

    return { ref, isExpanded };
}

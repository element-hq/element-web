/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * A hook to manage the wrapping of filters in the room list.
 * It observes the filter list and hides filters that are wrapping when the list is not expanded.
 * @param isExpanded
 * @returns an object containing:
 * - `ref`: a ref to put on the filter list element
 * - `isWrapping`: a boolean indicating if the filters are wrapping
 * - `wrappingIndex`: the index of the first filter that is wrapping
 */
export function useCollapseFilters<T extends HTMLElement>(
    isExpanded: boolean,
): {
    ref: RefObject<T | null>;
    isWrapping: boolean;
    wrappingIndex: number;
} {
    const ref = useRef<T>(null);
    const [isWrapping, setIsWrapping] = useState(false);
    const [wrappingIndex, setWrappingIndex] = useState(-1);

    useEffect(() => {
        if (!ref.current) return;

        const hideFilters = (list: Element): void => {
            let isWrapping = false;
            Array.from(list.children).forEach((node, i): void => {
                const child = node as HTMLElement;
                const wrappingClass = "mx_RoomListPrimaryFilters_wrapping";
                child.setAttribute("aria-hidden", "false");
                child.classList.remove(wrappingClass);

                // If the filter list is expanded, all filters are visible
                if (isExpanded) return;

                // If the previous element is on the left element of the current one, it means that the filter is wrapping
                const previousSibling = child.previousElementSibling as HTMLElement | null;
                if (previousSibling && child.offsetLeft <= previousSibling.offsetLeft) {
                    if (!isWrapping) setWrappingIndex(i);
                    isWrapping = true;
                }

                // If the filter is wrapping, we hide it
                child.classList.toggle(wrappingClass, isWrapping);
                child.setAttribute("aria-hidden", isWrapping.toString());
            });

            if (!isWrapping) setWrappingIndex(-1);
            setIsWrapping(isExpanded || isWrapping);
        };

        hideFilters(ref.current);
        const observer = new ResizeObserver((entries) => entries.forEach((entry) => hideFilters(entry.target)));

        observer.observe(ref.current);
        return () => {
            observer.disconnect();
        };
    }, [isExpanded]);

    return { ref, isWrapping, wrappingIndex };
}

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { useCallback, useEffect, useRef, useState } from "react";
import { debounce } from "lodash";

/** How long the width has to settle for before we act on it, so that dragging the panel doesn't re-render constantly. */
const RESIZE_DEBOUNCE_MS = 150;

/**
 * Tracks the content width of an element.
 *
 * @returns a ref to attach to the element to measure, and its current width in CSS pixels
 *     (`undefined` until it has been measured).
 */
export function useResizeObserver(): [(node: HTMLDivElement | null) => void, number | undefined] {
    const [width, setWidth] = useState<number | undefined>(undefined);
    const cleanup = useRef<() => void>(undefined);

    useEffect(() => () => cleanup.current?.(), []);

    const ref = useCallback((node: HTMLDivElement | null) => {
        cleanup.current?.();
        cleanup.current = undefined;
        if (!node) return;

        // ResizeObserver fires once as soon as we observe, so `leading` gives us the initial width
        // straight away and the trailing edge keeps up with the panel once dragging stops.
        // contentRect excludes the padding, which is the space we actually render into.
        const onResize = debounce(
            (entries: ResizeObserverEntry[]) => setWidth(Math.floor(entries[entries.length - 1].contentRect.width)),
            RESIZE_DEBOUNCE_MS,
            { leading: true, trailing: true },
        );
        const observer = new ResizeObserver(onResize);
        observer.observe(node);
        cleanup.current = () => {
            onResize.cancel();
            observer.disconnect();
        };
    }, []);

    return [ref, width];
}

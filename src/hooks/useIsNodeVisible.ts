/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useCallback, useEffect, useState, type RefCallback } from "react";

/**
 * A hook to check if a node is visible in the viewport.
 * This hook uses the Intersection Observer API to observe the visibility of a node.
 * Both {@link rootRef} and {@link nodeRef} can be changed at any time, the hook will re-observe the node.
 *
 * @param options - see {@link IntersectionObserverInit} for more details. Root argument is omitted, see {@link rootRef} instead.
 */
export function useIsNodeVisible<T extends HTMLElement, J extends HTMLElement>(
    options?: Omit<IntersectionObserverInit, "root">,
): {
    /**
     * Whether the node is visible in the viewport. `null` if the node the root ref are not set.
     */
    isVisible: boolean | null;
    /**
     * A ref to the node to be observed.
     */
    nodeRef: RefCallback<T>;
    /**
     * A ref to be used as the root for the Intersection Observer. See {@link IntersectionObserverInit.root} for more details.
     */
    rootRef: RefCallback<J>;
} {
    const [isVisible, setIsVisible] = useState<boolean | null>(null);

    // We use ref callback and a state because using only a ref would not trigger a re-render if the node or the root changes
    const [watchedNode, setWatchedNode] = useState<T | null>(null);
    const nodeRef = useCallback((node: T | null) => setWatchedNode(node), []);

    const [rootNode, setRootNode] = useState<J | null>(null);
    const rootRef = useCallback((node: J | null) => setRootNode(node), []);

    useEffect(() => {
        // If the node or the root is not set, we don't need to observe anything
        if (!watchedNode || !rootNode) {
            setIsVisible(null);
            return;
        }

        const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), {
            root: rootNode,
            ...options,
        });

        observer.observe(watchedNode);
        return () => {
            observer.disconnect();
        };
    }, [watchedNode, rootNode, options]);

    return { isVisible, nodeRef, rootRef };
}

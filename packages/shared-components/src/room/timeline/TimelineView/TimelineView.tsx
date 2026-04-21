/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useMemo, useRef, type JSX, type ReactNode } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import { useViewModel } from "../../../core/viewmodel/useViewModel";
import type { TimelineItem, TimelineViewProps } from "./types";

/**
 * Shared virtualized timeline container.
 *
 * Renders an ordered list of timeline items using react-virtuoso.
 * The consuming app controls what each row looks like via `renderItem`;
 * this component owns layout, scrolling, pagination triggers, and
 * stuck-at-bottom tracking.
 */

/** Pre-render this many pixels above and below the visible viewport. */
const OVERSCAN_PX = 600;

/**
 * On initial mount Virtuoso only reads `initialTopMostItemIndex` once.
 * `'LAST'` tells it to land on the final item and align it to the end of
 * the viewport, giving a correct bottom-of-room starting position.
 */
const INITIAL_BOTTOM = { index: "LAST" as const, align: "end" as const };

export function TimelineView({ vm, renderItem }: TimelineViewProps): JSX.Element {
    const snapshot = useViewModel(vm);
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    const increaseViewportBy = useMemo(() => ({ top: OVERSCAN_PX, bottom: OVERSCAN_PX }), []);

    const itemContent = useCallback(
        (_index: number, item: TimelineItem): ReactNode => {
            // `display: flow-root` establishes a new block formatting context so that any
            // margins on the rendered content cannot collapse out through the item wrapper.
            // Without this, Virtuoso's `getBoundingClientRect()` measurement under-reports
            // item height by the child's margin-top/margin-bottom, which accumulates over
            // many items and causes scroll anchor drift during prepend/backfill.
            return <div style={{ display: "flow-root" }}>{renderItem(item)}</div>;
        },
        [renderItem],
    );

    // Scroll to the pending anchor when it is set and the target item is in the data
    // array. Handles both permalink navigation and scroll-position restore. We depend
    // on `snapshot.items` so we retry after each pagination batch in case the target
    // wasn't in the initial load window.
    useEffect(() => {
        const anchor = snapshot.pendingAnchor;
        if (!anchor) return;

        const arrayIndex = snapshot.items.findIndex((item) => item.key === anchor.targetKey);
        if (arrayIndex === -1) return; // not loaded yet — wait for next items update

        virtuosoRef.current?.scrollToIndex({
            index: snapshot.firstItemIndex + arrayIndex,
            align: anchor.align,
            behavior: "auto",
        });
        vm.onAnchorReached();
    }, [snapshot.pendingAnchor, snapshot.items, snapshot.firstItemIndex, vm]);

    // Don't mount Virtuoso until items are ready — ensures `initialTopMostItemIndex`
    // is passed with the correct value on Virtuoso's first mount.
    if (snapshot.items.length === 0) {
        return <div style={{ height: "100%", width: "100%" }} />;
    }

    return (
        <Virtuoso
            ref={virtuosoRef}
            initialTopMostItemIndex={INITIAL_BOTTOM}
            data={snapshot.items}
            firstItemIndex={snapshot.firstItemIndex}
            increaseViewportBy={increaseViewportBy}
            itemContent={itemContent}
            atBottomStateChange={vm.onStuckAtBottomChanged}
            startReached={vm.onStartReached}
            endReached={vm.onEndReached}
            followOutput={snapshot.stuckAtBottom ? "smooth" : false}
            alignToBottom
            style={{ height: "100%", width: "100%" }}
        />
    );
}
